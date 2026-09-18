import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  AuthError,
  PostgrestError,
  Session,
  SupabaseClient,
  createClient,
} from '@supabase/supabase-js';

import { environment } from '../../environments/environment';
import { COPY } from './copy';
import { Database } from './database.types';
import { NotifyService } from './notify.service';

/**
 * The only error shape the rest of the app ever sees. Raw PostgREST and GoTrue
 * errors stop here (docs/ARCHITECTURE.md §6, §10) — components never parse them,
 * and `message` is always safe to render.
 */
export interface AppError {
  /** Hebrew, user-facing. Goes straight into a toast. */
  message: string;
  /** Machine code for the log, e.g. '23505' or 'invalid_credentials'. */
  code: string;
  /** The original error, for the logger only. Never rendered. */
  cause: unknown;
}

export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === 'object' && value !== null && 'message' in value && 'code' in value
  );
}

type QueryResult<T> = { data: T | null; error: PostgrestError | null };

/**
 * Postgres / PostgREST codes worth a specific message. Anything unmapped falls
 * back to `generic` — a wrong-but-calm message beats leaking a constraint name.
 */
const POSTGREST_MESSAGES: Record<string, string> = {
  '23505': COPY.errors.duplicate, // unique_violation
  '23503': COPY.errors.notFound, // foreign_key_violation — parent row is gone
  '42501': COPY.errors.notAllowed, // insufficient_privilege — an RLS write denial
  PGRST116: COPY.errors.notFound, // .single() matched no rows
  PGRST301: COPY.errors.sessionExpired, // JWT expired
};

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: COPY.errors.signInFailed,
  email_not_confirmed: COPY.errors.emailNotConfirmed,
  user_already_exists: COPY.errors.emailTaken,
  email_exists: COPY.errors.emailTaken,
  weak_password: COPY.errors.weakPassword,
  over_request_rate_limit: COPY.errors.tooManyRequests,
  over_email_send_rate_limit: COPY.errors.tooManyRequests,
  session_expired: COPY.errors.sessionExpired,
  same_password: COPY.errors.samePassword,
  // A recovery link that is expired, already used, or was never valid. GoTrue reports
  // all three differently; to the person holding a dead link they are one situation.
  otp_expired: COPY.errors.recoveryInvalid,
  reauthentication_needed: COPY.errors.recoveryInvalid,
  session_not_found: COPY.errors.recoveryInvalid,
};

/** Tables the delete-account screen counts before it lets anyone press the button. */
export type CountableTable = 'leads' | 'activities' | 'reminders';

/**
 * Codes where the server told us plainly why it refused. The user can act on the
 * message, nothing was half-written, and the work continues — so these announce.
 * Anything NOT in this set that happened during a write is the case the interrupt
 * exists for: we do not know whether the row landed, and the user believes it did.
 */
const EXPLAINED_CODES = new Set<string>([
  '23505', // unique_violation — the row already exists
  '23503', // foreign_key_violation — the parent is gone
  '42501', // insufficient_privilege — an RLS denial
  'PGRST116', // matched no rows
  'PGRST301', // JWT expired; the redirect to sign-in is the interruption
  'network', // nothing left the browser, so nothing is half-written
  ...Object.keys(AUTH_MESSAGES),
]);

/**
 * Decides popup versus toast — the one rule the notification layer runs on.
 *
 * @param error the normalized error
 * @param wasWrite whether the failed call was a mutation. A failed read costs a
 *   refresh; a failed write can cost a lead. Same code, different severity, so the
 *   caller has to say which it was.
 */
export function costsData(error: AppError, wasWrite: boolean): boolean {
  if (!wasWrite) return false;
  return !EXPLAINED_CODES.has(error.code);
}

/**
 * The single door to Supabase: one client, the auth session as signals, and the
 * one place a raw server error is allowed to exist (docs/ARCHITECTURE.md §7 core/).
 *
 * Authorization is not implemented here. It is entirely RLS on `tenant_id` — the
 * client is never trusted, so there is deliberately no tenant filtering in this
 * service beyond what queries ask for.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient<Database>;

  private readonly router = inject(Router);
  private readonly notify = inject(NotifyService);

  private readonly _session = signal<Session | null>(null);
  private readonly _ready = signal(false);
  private readonly _recovery = signal(false);
  private readonly _tenantId = signal<string | null>(null);
  private readonly _signingOut = signal(false);
  private readonly _sessionEpoch = signal(0);

  readonly session = this._session.asReadonly();
  /** False until the stored session has been restored — route guards must wait on it. */
  readonly ready = this._ready.asReadonly();
  readonly user = computed(() => this._session()?.user ?? null);
  readonly isAuthenticated = computed(() => this._session() !== null);

  /**
   * True between a recovery link being consumed and the new password being saved.
   * A recovery link mints a real session, so this is the only way the set-new-password
   * screen can tell "arrived from the email" apart from "was already signed in".
   */
  readonly inRecovery = this._recovery.asReadonly();

  /** The name the trigger wrote at signup, and what the masthead monogram is cut from. */
  readonly displayName = computed(() => {
    const user = this.user();
    if (!user) return '';
    const meta = user.user_metadata as { display_name?: unknown } | undefined;
    const name = typeof meta?.display_name === 'string' ? meta.display_name.trim() : '';
    return name || (user.email ?? '').split('@')[0];
  });

  readonly email = computed(() => this.user()?.email ?? '');

  /** True while a sign-out is in flight, from either door — the masthead or the profile. */
  readonly signingOut = this._signingOut.asReadonly();

  /**
   * Increments on every sign-out. The stores are root singletons, so without this they
   * keep the previous user's leads, reminders and stats in memory after the session ends —
   * and the cached `tenantId` means the next sign-in scopes its first query to the
   * *previous* tenant. RLS returns no rows rather than another tenant's data, so this is
   * not a leak, but the board would show a stale or wrongly-empty pipeline.
   *
   * Exposed as a counter the stores watch, rather than this service calling into them:
   * the stores depend on this service, so the reverse dependency would be a cycle. Each
   * store owns its own reset and only the ones that were actually constructed react.
   */
  readonly sessionEpoch = this._sessionEpoch.asReadonly();

  /**
   * Resolves once the stored session has been restored. Route guards await this instead
   * of polling `ready`, so a signed-in user never sees the sign-in screen flash past on
   * a cold load — and an unauthenticated one is not redirected before we know.
   */
  readonly whenReady: Promise<void>;
  private markReady!: () => void;

  constructor() {
    this.whenReady = new Promise<void>((resolve) => (this.markReady = resolve));

    const { supabaseUrl, supabasePublishableKey } = environment;

    if (!supabaseUrl || !supabasePublishableKey) {
      // Fail at startup, not on the first query where it would surface as a
      // confusing network error. See src/environments/environment.ts (local stack) and
      // environment.prod.ts (the cloud project).
      throw new Error(
        'Supabase is not configured: supabaseUrl and supabasePublishableKey are empty. ' +
          'Set them in src/environments/environment.ts (local) or ' +
          'src/environments/environment.prod.ts (production).',
      );
    }

    this.client = createClient<Database>(supabaseUrl, supabasePublishableKey);

    // Fires once with the restored session, then on every sign-in, sign-out and
    // token refresh. This is the only writer of `_session`.
    this.client.auth.onAuthStateChange((event, session) => {
      this._session.set(session);
      this._ready.set(true);
      this.markReady();

      if (event === 'PASSWORD_RECOVERY') this._recovery.set(true);
      if (event === 'SIGNED_OUT') {
        this._recovery.set(false);
        this._sessionEpoch.update((n) => n + 1);
      }
    });
  }

  /* ---------- data ---------- */

  /**
   * Runs a PostgREST query and returns its rows, or throws an AppError.
   *
   *   const leads = await supabase.run(supabase.client.from('leads').select('*'));
   *
   * Note what an empty result means: RLS denies reads by filtering rows, not by
   * erroring. A caller that gets `[]` may be unauthorized rather than looking at
   * an empty tenant — treat the two the same, because the server does.
   */
  async run<T>(query: PromiseLike<QueryResult<T>>): Promise<T> {
    let result: QueryResult<T>;

    try {
      result = await query;
    } catch (cause) {
      // fetch() itself rejected — no HTTP response, so this is connectivity.
      throw this.fromTransport(cause);
    }

    if (result.error) throw this.fromPostgrest(result.error);
    return result.data as T;
  }

  /* ---------- auth ---------- */

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw this.fromAuth(error);
  }

  /**
   * `display_name` is not decoration: the handle_new_user trigger reads it out of
   * raw_user_meta_data to name both the profile and the auto-created personal
   * tenant (see supabase/migrations, §7c). Sign up without it and the tenant falls
   * back to the email local-part.
   */
  async signUp(email: string, password: string, displayName: string): Promise<void> {
    const { error } = await this.client.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) throw this.fromAuth(error);
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) throw this.fromAuth(error);
  }

  /**
   * The one sign-out flow — busy state, the call itself, the redirect and the toast —
   * shared by the masthead's icon-only control and the profile screen's labelled one.
   * Two entry points, one behaviour, so they cannot drift apart: a failure here is a
   * recoverable toast, never the critical popup, because nothing the user owns is at
   * risk when a sign-out fails.
   */
  async signOutAndLeave(): Promise<void> {
    if (this._signingOut()) return;
    this._signingOut.set(true);
    try {
      await this.signOut();
      await this.router.navigateByUrl('/auth/sign-in');
      this.notify.succeeded(COPY.profile.signedOut);
    } catch (error) {
      this.notify.failed(isAppError(error) ? error.message : COPY.errors.generic);
    } finally {
      this._signingOut.set(false);
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    const redirectTo =
      typeof window === 'undefined' ? undefined : `${window.location.origin}/auth/reset/new`;

    const { error } = await this.client.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw this.fromAuth(error);
  }

  /**
   * Sets a new password on the current session — used by both the recovery screen and
   * the profile. `secure_password_change` is off in config.toml, so GoTrue does not ask
   * for the old password; when the caller is a signed-in user rather than a recovery
   * link, `reauthenticate` is what supplies that check.
   */
  async updatePassword(password: string): Promise<void> {
    const { error } = await this.client.auth.updateUser({ password });
    if (error) throw this.fromAuth(error);
    this._recovery.set(false);
  }

  /**
   * Proves the person at the keyboard knows the current password, by using it. Throws
   * `wrongPassword` if not. Succeeds silently — the returned session replaces the
   * current one, which is the same user and the same tenant.
   */
  async reauthenticate(password: string): Promise<void> {
    const email = this.email();
    if (!email) throw this.fromTransport(new Error('no session'));

    const { error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) {
      const mapped = this.fromAuth(error);
      throw mapped.code === 'invalid_credentials'
        ? { ...mapped, message: COPY.errors.wrongPassword }
        : mapped;
    }
  }

  /**
   * Renames the user in both places that hold the name: the auth metadata (which the
   * masthead reads) and the `profiles` row (which co-members read). The tenant name is
   * left alone on purpose — it was seeded from this name at signup but is a separate
   * thing the moment a second person joins.
   */
  async updateDisplayName(displayName: string): Promise<void> {
    const user = this.user();
    if (!user) throw this.fromTransport(new Error('no session'));

    const { error } = await this.client.auth.updateUser({ data: { display_name: displayName } });
    if (error) throw this.fromAuth(error);

    await this.run(
      this.client.from('profiles').update({ display_name: displayName }).eq('id', user.id) as never,
    );
  }

  /**
   * The tenant the signed-in member belongs to. `memberships` is the only table that
   * names it — the same resolution LeadsStore does for the pipeline — read directly
   * here rather than through that store, which is a different layer and would reach
   * outside what a profile screen needs.
   */
  async resolveTenantId(): Promise<string | null> {
    const known = this._tenantId();
    if (known) return known;

    const rows = await this.run<{ tenant_id: string }[]>(
      this.client.from('memberships').select('tenant_id').limit(1) as never,
    );
    const tenantId = rows?.[0]?.tenant_id ?? null;
    this._tenantId.set(tenantId);
    return tenantId;
  }

  /** The business name as it stands today, for the profile screen to show before editing. */
  async getTenantName(tenantId: string): Promise<string> {
    const rows = await this.run<{ name: string }[]>(
      this.client.from('tenants').select('name').eq('id', tenantId).limit(1) as never,
    );
    return rows?.[0]?.name ?? '';
  }

  /**
   * Renames the tenant — the business name, seeded once by the signup trigger and never
   * writable anywhere since. `tenants_update` is RLS'd to the owner only
   * (`private.is_tenant_owner`), so a member who is not the owner gets `42501`, which
   * `fromPostgrest` already maps to `errors.notAllowed` — no new error mapping needed.
   */
  async updateTenantName(tenantId: string, name: string): Promise<void> {
    await this.run(
      this.client.from('tenants').update({ name }).eq('id', tenantId) as never,
    );
  }

  /**
   * Deletes the auth user, which is the only domino that has to be pushed by hand:
   * `profiles` cascades from `auth.users`, `memberships` cascades from `profiles`, and
   * the `memberships_delete_orphan_tenant` trigger drops any tenant left without members
   * — taking its leads, activities, reminders and answers with it.
   *
   * It runs in an Edge Function because deleting a user needs the secret key, which
   * never ships to the browser.
   */
  async deleteAccount(): Promise<void> {
    const { error } = await this.client.functions.invoke('delete-account', { body: {} });
    if (error) {
      throw { message: COPY.errors.deleteFailed, code: 'delete_account_failed', cause: error };
    }
    await this.client.auth.signOut();
  }

  /**
   * How many rows this user can see in a table. RLS makes that "this tenant's rows",
   * which is exactly what the delete-account screen has to state out loud.
   */
  async countRows(table: CountableTable): Promise<number> {
    try {
      const { count, error } = await this.client
        .from(table)
        .select('*', { count: 'exact', head: true });
      if (error) throw this.fromPostgrest(error);
      return count ?? 0;
    } catch (cause) {
      if (isAppError(cause)) throw cause;
      throw this.fromTransport(cause);
    }
  }

  /* ---------- error normalization ---------- */

  private fromPostgrest(error: PostgrestError): AppError {
    return {
      message: POSTGREST_MESSAGES[error.code] ?? COPY.errors.generic,
      code: error.code,
      cause: error,
    };
  }

  private fromAuth(error: AuthError): AppError {
    const code = error.code ?? `auth_${error.status ?? 'unknown'}`;
    return {
      message: AUTH_MESSAGES[code] ?? COPY.errors.generic,
      code,
      cause: error,
    };
  }

  private fromTransport(cause: unknown): AppError {
    return { message: COPY.errors.offline, code: 'network', cause };
  }
}
