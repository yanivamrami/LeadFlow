import { Injectable, effect, inject, signal, untracked } from '@angular/core';

import { COPY } from './copy';
import { NotifyService } from './notify.service';
import { AppError, SupabaseService, costsData, isAppError } from './supabase.service';

/**
 * Per-stage automations — SCREENS 9.2/9.3/9.4, documents/CONTRACT-stages.md §2,
 * documents/PLAN-automations.md §2-3. Modelled on `StagesStore`: root-provided, signals,
 * the same offline-guard / busy-id / report-and-retoast write pattern.
 *
 * `automations` and `automation_runs` are not in the generated Database types (the
 * migrations that add them have not been run against the project those types were
 * regenerated from — same situation `StagesStore` documents on its own `table()`/`raw()`).
 * Regenerating the types after those migrations ship removes the two escape hatches below.
 */

export type AutomationTrigger = 'lead_enters_stage' | 'lead_idle_in_stage';
export type AutomationAction = 'set_reminder' | 'assign_member' | 'add_note' | 'suggest_advance' | 'webhook';
export type RunStatus = 'queued' | 'sending' | 'done' | 'failed' | 'skipped';

export interface SetReminderConfig {
  days: number;
  title: string | null;
}
export interface AssignMemberConfig {
  userId: string;
}
export interface AddNoteConfig {
  body: string;
}
export interface SuggestAdvanceConfig {
  stageId: string;
}
export interface WebhookConfig {
  url: string;
  /** A reference name, never the raw secret — see `automations-panel.ts` for why. */
  secretRef: string;
}

/** `idle_days` is required exactly when the trigger is `lead_idle_in_stage` — the same
 *  pairing `automations_idle_days_ck` enforces server-side. Typing it as a union rather
 *  than `idleDays: number | null` means a caller cannot construct the illegal combination
 *  and only find out from a 23514 at save time. */
export type TriggerInput =
  | { trigger: 'lead_enters_stage'; idleDays: null }
  | { trigger: 'lead_idle_in_stage'; idleDays: number };

export type ActionInput =
  | { action: 'set_reminder'; config: SetReminderConfig }
  | { action: 'assign_member'; config: AssignMemberConfig }
  | { action: 'add_note'; config: AddNoteConfig }
  | { action: 'suggest_advance'; config: SuggestAdvanceConfig }
  | { action: 'webhook'; config: WebhookConfig };

/** What the editor builds and `create`/`update` write. */
export type NewAutomationInput = { stageId: string } & TriggerInput & ActionInput;

/** One rule, as read back from the server. */
export type Automation = {
  id: string;
  tenantId: string;
  stageId: string;
  enabled: boolean;
  /** Set the moment this rule's stage is archived; distinct from `enabled` (see the
   *  migration comment on `automations.suspended_at`). Un-archiving does not clear it —
   *  re-enabling a suspended rule is always a deliberate, separate act. */
  suspendedAt: Date | null;
  createdAt: Date;
} & TriggerInput &
  ActionInput;

export interface AutomationRun {
  id: string;
  automationId: string;
  leadId: string;
  /** Null only if the lead row is gone — the FK is `on delete cascade`, so in practice
   *  this run row would not survive that either, but the join is left defensive. */
  leadName: string | null;
  status: RunStatus;
  attempt: number;
  /** Human-readable, written by the trigger/worker — never re-derived on the client. */
  skipReason: string | null;
  error: string | null;
  runAfter: Date;
  completedAt: Date | null;
  createdAt: Date;
}

export interface TenantMember {
  id: string;
  displayName: string;
}

interface AutomationRow {
  id: string;
  tenant_id: string;
  stage_id: string;
  trigger: AutomationTrigger;
  idle_days: number | null;
  action: AutomationAction;
  config: Record<string, unknown> | null;
  enabled: boolean;
  suspended_at: string | null;
  created_at: string;
}

interface AutomationRunRow {
  id: string;
  automation_id: string;
  lead_id: string;
  status: RunStatus;
  attempt: number;
  skip_reason: string | null;
  error: string | null;
  run_after: string;
  completed_at: string | null;
  created_at: string;
  leads: { name: string } | null;
}

interface MembershipRow {
  user_id: string;
  profiles: { display_name: string | null } | null;
}

const SELECT =
  'id, tenant_id, stage_id, trigger, idle_days, action, config, enabled, suspended_at, created_at';

const RUN_SELECT =
  'id, automation_id, lead_id, status, attempt, skip_reason, error, run_after, completed_at, created_at, leads ( name )';

/** The run log shows the last 50 (documents/PLAN-automations.md §4, SCREENS 9.4). */
const RUN_LOG_LIMIT = 50;

/** Toasts this store raises. Kept local rather than added to `core/copy.ts` — this agent
 *  does not own that file (documents/CONTRACT-stages.md §4). */
const NOTICE = {
  created: 'הכלל נוסף לשלב.',
  updated: 'הכלל עודכן.',
  enabled: 'הכלל הופעל.',
  disabled: 'הכלל כובה.',
  deleted: 'הכלל נמחק.',
} as const;

@Injectable({ providedIn: 'root' })
export class AutomationsStore {
  private readonly supabase = inject(SupabaseService);
  private readonly notify = inject(NotifyService);

  private readonly _rules = signal<Automation[]>([]);
  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);
  private readonly _failed = signal(false);
  private readonly _busyId = signal<string | null>(null);

  constructor() {
    // Sign-out empties this store for the same reason it empties the pipeline and the
    // reminders: a root singleton would otherwise hand the next user on this browser the
    // previous one's automation rules. Epoch 0 is the initial value, not a sign-out.
    effect(() => {
      if (this.supabase.sessionEpoch() > 0) untracked(() => this.reset());
    });
  }

  reset(): void {
    this._rules.set([]);
    this._loaded.set(false);
    this._failed.set(false);
    this._loading.set(false);
    this._busyId.set(null);
  }

  readonly rules = this._rules.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly loadFailed = this._failed.asReadonly();
  readonly busyId = this._busyId.asReadonly();

  /** Every rule on one stage, in creation order — the order the trigger evaluates them in. */
  byStage(stageId: string): Automation[] {
    return this._rules().filter((r) => r.stageId === stageId);
  }

  /* ---------- read ---------- */

  /** Loads once. Several `AutomationsPanel` instances mount at once (one per stage row)
   *  and each calls this in its constructor — the loaded-guard means only the first does
   *  any work, and the rest read the same signal once it lands. */
  async load(): Promise<void> {
    if (this._loading() || this._loaded()) return;
    await this.fetch();
  }

  /** Forces a re-read regardless of `loaded` — the retry button on a failed load. */
  async reload(): Promise<void> {
    await this.fetch();
  }

  private async fetch(): Promise<void> {
    this._loading.set(true);
    this._failed.set(false);
    try {
      const tenantId = await this.requireTenant();
      const rows = await this.supabase.run<AutomationRow[]>(
        this.table()
          .select(SELECT)
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: true }) as never,
      );
      this._rules.set((rows ?? []).map((row) => this.toAutomation(row)));
      this._loaded.set(true);
    } catch (error) {
      this._failed.set(true);
      this.report(error, false);
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Last 50 runs for one rule, newest first (SCREENS 9.4). Left as a plain async read
   * rather than a cached signal: the run log is opened per-rule, on demand, and the
   * calling component owns its own loading/failed/empty/populated state the same way
   * `Stages` owns its lead-count read — this keeps that four-state UI local to the one
   * place it is shown instead of threading it through this store.
   */
  async fetchRuns(automationId: string): Promise<AutomationRun[]> {
    const rows = await this.supabase.run<AutomationRunRow[]>(
      this.runsTable()
        .select(RUN_SELECT)
        .eq('automation_id', automationId)
        .order('created_at', { ascending: false })
        .limit(RUN_LOG_LIMIT) as never,
    );
    return (rows ?? []).map((row) => ({
      id: row.id,
      automationId: row.automation_id,
      leadId: row.lead_id,
      leadName: row.leads?.name ?? null,
      status: row.status,
      attempt: row.attempt,
      skipReason: row.skip_reason,
      error: row.error,
      runAfter: new Date(row.run_after),
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      createdAt: new Date(row.created_at),
    }));
  }

  /** Tenant members, for the `assign_member` picker (SCREENS 9.3). Read directly rather
   *  than through a dedicated members store — nothing else in this feature needs one, and
   *  `SupabaseService` itself only resolves the current user's own tenant id, not the
   *  roster (see its `resolveTenantId` comment). */
  async loadTenantMembers(): Promise<TenantMember[]> {
    const tenantId = await this.requireTenant();
    const rows = await this.supabase.run<MembershipRow[]>(
      this.supabase.client
        .from('memberships')
        .select('user_id, profiles ( display_name )')
        .eq('tenant_id', tenantId) as never,
    );
    return (rows ?? []).map((row) => ({
      id: row.user_id,
      displayName: row.profiles?.display_name?.trim() || 'חבר צוות ללא שם',
    }));
  }

  /* ---------- writes ---------- */

  /**
   * Returns the new rule's id, not just success — a webhook rule needs a signing secret
   * minted against it immediately afterwards, and the caller cannot ask for one without the
   * id. `null` means the insert failed and has already reported itself.
   */
  async create(input: NewAutomationInput): Promise<string | null> {
    if (!this.notify.online()) {
      this.notify.blockedOffline();
      return null;
    }
    this._busyId.set('create');
    try {
      const tenantId = await this.requireTenant();
      const rows = await this.supabase.run<{ id: string }[]>(
        this.table()
          .insert({
            tenant_id: tenantId,
            stage_id: input.stageId,
            trigger: input.trigger,
            idle_days: input.idleDays,
            action: input.action,
            config: this.toConfigRow(input),
          })
          .select('id') as never,
      );
      await this.fetch();
      this.notify.succeeded(NOTICE.created);
      return rows?.[0]?.id ?? null;
    } catch (error) {
      this.report(error, false);
      return null;
    } finally {
      this._busyId.set(null);
    }
  }

  /**
   * Mints (or rotates) the webhook signing secret for a rule and returns the plaintext the
   * one and only time it is ever available.
   *
   * The secret is generated in the database, not here. A browser-generated secret had nowhere
   * to be stored that the sender could read it back from — the rule saved, the key was shown,
   * and every send then failed for want of a signing key. `mint_webhook_secret`
   * (20260804091200) writes it to Vault and records only the *name* on the rule, so this
   * return value is the only copy the user will see.
   */
  async mintSecret(automationId: string): Promise<string | null> {
    try {
      const secret = await this.supabase.run<string>(
        this.rpc()('mint_webhook_secret', { p_automation_id: automationId }) as never,
      );
      await this.fetch();
      return secret ?? null;
    } catch (error) {
      this.report(error, false);
      return null;
    }
  }

  /** Full replace of trigger/action/config — the editor always resubmits the whole rule,
   *  the same "reload is authoritative" pattern `StagesStore.commit` uses. `input.stageId`
   *  is accepted (the editor always has one to hand) but deliberately not written: a rule
   *  does not move between stages by editing it, only by being deleted and re-created on
   *  the one the user actually meant. */
  async update(id: string, input: NewAutomationInput): Promise<boolean> {
    const rule = this.byId(id);
    if (!rule) return false;

    return this.commit(id, () =>
      this.supabase.run(
        this.table()
          .update({
            trigger: input.trigger,
            idle_days: input.idleDays,
            action: input.action,
            config: this.toConfigRow(input),
          })
          .eq('id', id) as never,
      ),
    ).then((ok) => {
      if (ok) this.notify.succeeded(NOTICE.updated);
      return ok;
    });
  }

  async setEnabled(id: string, enabled: boolean): Promise<boolean> {
    const rule = this.byId(id);
    if (!rule) return false;

    const ok = await this.commit(id, () =>
      this.supabase.run(this.table().update({ enabled }).eq('id', id) as never),
    );
    if (ok) this.notify.succeeded(enabled ? NOTICE.enabled : NOTICE.disabled);
    return ok;
  }

  async remove(id: string): Promise<boolean> {
    const rule = this.byId(id);
    if (!rule) return false;

    const ok = await this.commit(id, () =>
      this.supabase.run(this.table().delete().eq('id', id) as never),
    );
    if (ok) this.notify.succeeded(NOTICE.deleted);
    return ok;
  }

  /* ---------- plumbing ---------- */

  private byId(id: string): Automation | undefined {
    return this._rules().find((r) => r.id === id);
  }

  private toConfigRow(input: ActionInput): Record<string, unknown> {
    switch (input.action) {
      case 'set_reminder':
        return { days: input.config.days, title: input.config.title };
      case 'assign_member':
        return { user_id: input.config.userId };
      case 'add_note':
        return { body: input.config.body };
      case 'suggest_advance':
        return { stage_id: input.config.stageId };
      case 'webhook':
        return { url: input.config.url, secret_ref: input.config.secretRef };
    }
  }

  private toAutomation(row: AutomationRow): Automation {
    const cfg = row.config ?? {};
    const base = {
      id: row.id,
      tenantId: row.tenant_id,
      stageId: row.stage_id,
      enabled: row.enabled,
      suspendedAt: row.suspended_at ? new Date(row.suspended_at) : null,
      createdAt: new Date(row.created_at),
      trigger: row.trigger,
      idleDays: row.idle_days,
    };

    switch (row.action) {
      case 'set_reminder':
        return {
          ...base,
          action: 'set_reminder',
          config: { days: Number(cfg['days'] ?? 0), title: (cfg['title'] as string) || null },
        } as Automation;
      case 'assign_member':
        return {
          ...base,
          action: 'assign_member',
          config: { userId: String(cfg['user_id'] ?? '') },
        } as Automation;
      case 'add_note':
        return {
          ...base,
          action: 'add_note',
          config: { body: String(cfg['body'] ?? '') },
        } as Automation;
      case 'suggest_advance':
        return {
          ...base,
          action: 'suggest_advance',
          config: { stageId: String(cfg['stage_id'] ?? '') },
        } as Automation;
      case 'webhook':
        return {
          ...base,
          action: 'webhook',
          config: { url: String(cfg['url'] ?? ''), secretRef: String(cfg['secret_ref'] ?? '') },
        } as Automation;
    }
  }

  /** Same shape as `StagesStore.commit`: offline blocks up front, a failure routes through
   *  `report` for severity, and success always re-reads rather than patching locally. */
  private async commit(busyKey: string, write: () => Promise<unknown>): Promise<boolean> {
    if (!this.notify.online()) {
      this.notify.blockedOffline();
      return false;
    }

    this._busyId.set(busyKey);
    const run = async () => {
      await write();
      await this.fetch();
    };

    try {
      await run();
      return true;
    } catch (error) {
      this.report(error, true, 'כלל האוטומציה', run);
      return false;
    } finally {
      this._busyId.set(null);
    }
  }

  private report(
    error: unknown,
    wasWrite: boolean,
    subject?: string,
    retry?: () => Promise<void>,
  ): void {
    const appError: AppError = isAppError(error)
      ? error
      : { message: COPY.errors.generic, code: 'unknown', cause: error };

    if (wasWrite && subject && retry && costsData(appError, true)) {
      this.notify.failedToPersist({ subject, run: retry }, appError.code);
      return;
    }
    this.notify.failed(appError.message);
  }

  private async requireTenant(): Promise<string> {
    const tenantId = await this.supabase.resolveTenantId();
    if (!tenantId) {
      throw { message: COPY.errors.notAllowed, code: '42501', cause: null } satisfies AppError;
    }
    return tenantId;
  }

  private table() {
    return this.raw().from('automations');
  }

  private runsTable() {
    return this.raw().from('automation_runs');
  }

  private raw(): { from: (name: string) => any } {
    return this.supabase.client as unknown as { from: (name: string) => any };
  }

  private rpc(): (name: string, args: Record<string, unknown>) => unknown {
    return (name, args) =>
      (
        this.supabase.client as unknown as {
          rpc: (n: string, a: Record<string, unknown>) => unknown;
        }
      ).rpc(name, args);
  }
}
