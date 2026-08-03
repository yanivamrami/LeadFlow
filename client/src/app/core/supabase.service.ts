import { Injectable, computed, signal } from '@angular/core';
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
};

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

  private readonly _session = signal<Session | null>(null);
  private readonly _ready = signal(false);

  readonly session = this._session.asReadonly();
  /** False until the stored session has been restored — route guards must wait on it. */
  readonly ready = this._ready.asReadonly();
  readonly user = computed(() => this._session()?.user ?? null);
  readonly isAuthenticated = computed(() => this._session() !== null);

  constructor() {
    const { supabaseUrl, supabasePublishableKey } = environment;

    if (!supabaseUrl || !supabasePublishableKey) {
      // Fail at startup, not on the first query where it would surface as a
      // confusing network error. Production is unconfigured on purpose until the
      // prod project exists — see src/environments/environment.ts.
      throw new Error(
        'Supabase is not configured: supabaseUrl and supabasePublishableKey are empty. ' +
          'Set them in src/environments/environment.ts (production) or ' +
          'src/environments/environment.development.ts (dev).',
      );
    }

    this.client = createClient<Database>(supabaseUrl, supabasePublishableKey);

    // Fires once with the restored session, then on every sign-in, sign-out and
    // token refresh. This is the only writer of `_session`.
    this.client.auth.onAuthStateChange((_event, session) => {
      this._session.set(session);
      this._ready.set(true);
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
