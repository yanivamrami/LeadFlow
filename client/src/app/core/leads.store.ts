import { Injectable, computed, inject, signal } from '@angular/core';

import { COPY, STATUS_GUIDANCE, STATUS_LABEL, daysBetween } from './copy';
import {
  Activity,
  ActivityType,
  Attention,
  CHECKLIST_ITEMS,
  ChecklistAnswers,
  ChecklistItem,
  DRIFT_DAYS,
  Lead,
  LeadDraft,
  LeadSaveExtras,
  LeadStatus,
  OPEN_ITEMS_CAP,
  OpenItem,
  OpenReason,
  QualificationAnswer,
  STAGE_ORDER,
  SortKey,
} from './lead.model';
import { NotifyService } from './notify.service';
import { AppError, SupabaseService, costsData, isAppError } from './supabase.service';

export type DashboardView = 'list' | 'board';

/**
 * The row shape PostgREST returns for the dashboard query. The `leads` table carries
 * none of the derived fields the dashboard needs — last contact lives in `activities`,
 * follow-ups in `reminders`, checklist progress in `qualification_answers` — so they
 * are embedded and folded in `toLead` rather than denormalized onto the table.
 */
interface LeadRow {
  id: string;
  tenant_id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: Lead['source'];
  status: LeadStatus;
  estimated_value: number | string | null;
  lost_reason: string | null;
  is_demo: boolean;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  activities: { id: string; type: ActivityType; body: string | null; occurred_at: string }[] | null;
  reminders: { id: string; title: string | null; due_at: string; done_at: string | null }[] | null;
  qualification_answers: { item: ChecklistItem; answer: QualificationAnswer }[] | null;
}

const SELECT = `
  id, tenant_id, name, company, email, phone, source, status, estimated_value,
  lost_reason, is_demo, assigned_to, created_at, updated_at,
  activities ( id, type, body, occurred_at ),
  reminders ( id, title, due_at, done_at ),
  qualification_answers ( item, answer )
`;

/**
 * Dashboard state. Signals only — the app is small enough that NgRx would be ceremony
 * (docs/ARCHITECTURE.md §4). Supabase is the source of truth; every mutation writes
 * first and updates local state from what came back, so the screen can never show a
 * lead the database refused.
 */
@Injectable({ providedIn: 'root' })
export class LeadsStore {
  private readonly supabase = inject(SupabaseService);
  private readonly notify = inject(NotifyService);

  private readonly _leads = signal<Lead[]>([]);
  private readonly _now = signal(new Date());
  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);
  private readonly _loadFailed = signal(false);
  private readonly _tenantId = signal<string | null>(null);

  readonly search = signal('');
  readonly sort = signal<SortKey>('urgency');
  readonly statusFilter = signal<LeadStatus | 'all'>('all');
  readonly view = signal<DashboardView>('list');
  readonly sheetExpanded = signal(false);
  readonly explainerDismissed = signal(false);
  /** Announced politely to screen readers after a stage move. */
  readonly announcement = signal('');

  readonly leads = this._leads.asReadonly();
  readonly now = this._now.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  /**
   * A read that failed is not an empty pipeline. Without this the register renders
   * "you have no leads yet" over a network error — a lie about the user's own data.
   */
  readonly loadFailed = this._loadFailed.asReadonly();
  readonly tenantId = this._tenantId.asReadonly();

  readonly total = computed(() => this._leads().length);

  readonly countByStatus = computed(() => {
    const counts = Object.fromEntries(STAGE_ORDER.map((s) => [s, 0])) as Record<
      LeadStatus,
      number
    >;
    for (const lead of this._leads()) counts[lead.status]++;
    return counts;
  });

  readonly clearedToday = computed(() => this._leads().filter((l) => l.clearedToday !== null));

  /**
   * Everything owed right now, most-overdue first. Drifting leads are the soft signal:
   * they flag their row in the register but only reach the day sheet when nothing
   * urgent is left — otherwise the sheet stops meaning "today" and starts meaning "someday".
   */
  readonly openItems = computed<OpenItem[]>(() => {
    const now = this._now();
    const items: OpenItem[] = [];

    for (const lead of this._leads()) {
      if (lead.clearedToday !== null) continue;
      const reason = this.openReason(lead, now);
      if (!reason) continue;
      items.push({ lead, reason, age: this.ageInDays(lead, now) });
    }

    const urgent = items.filter((item) => item.reason !== 'drifting');
    return (urgent.length ? urgent : items).sort((a, b) => b.age - a.age);
  });

  readonly visibleOpenItems = computed(() =>
    this.sheetExpanded() ? this.openItems() : this.openItems().slice(0, OPEN_ITEMS_CAP),
  );

  readonly hasHiddenOpenItems = computed(() => this.openItems().length > OPEN_ITEMS_CAP);

  readonly visibleLeads = computed(() => {
    const term = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    const key = this.sort();
    const now = this._now();

    return this._leads()
      .filter((lead) => status === 'all' || lead.status === status)
      .filter((lead) => {
        if (!term) return true;
        return [lead.name, lead.company, lead.phone, lead.email]
          .filter((v): v is string => !!v)
          .some((v) => v.toLowerCase().includes(term));
      })
      .sort((a, b) => this.compare(a, b, key, now));
  });

  /**
   * Every sort puts the answer at the top: the most urgent, the biggest, the quietest,
   * the newest. None of them ever sorts ascending — nobody opens a pipeline to find the
   * lead they care about least.
   */
  private compare(a: Lead, b: Lead, key: SortKey, now: Date): number {
    switch (key) {
      case 'value':
        return b.estimatedValue - a.estimatedValue;
      case 'quiet':
        return this.ageInDays(b, now) - this.ageInDays(a, now);
      case 'created':
        return b.createdAt.getTime() - a.createdAt.getTime();
      case 'urgency':
      default: {
        const rank: Record<Attention, number> = { now: 0, drift: 1, none: 2 };
        const byAttention = rank[this.attentionOf(a, now)] - rank[this.attentionOf(b, now)];
        if (byAttention !== 0) return byAttention;
        return this.ageInDays(b, now) - this.ageInDays(a, now);
      }
    }
  }

  readonly isFiltered = computed(
    () => this.statusFilter() !== 'all' || this.search().trim().length > 0,
  );

  readonly columns = computed(() =>
    STAGE_ORDER.map((status) => ({
      status,
      leads: this.visibleLeads().filter((lead) => lead.status === status),
    })),
  );

  /* ---------- loading ---------- */

  /**
   * Reads the pipeline. A failed read costs a refresh, never data, so it announces
   * rather than interrupting — and it leaves `loaded` false so the screen can say so.
   */
  async load(): Promise<void> {
    if (this._loading()) return;
    this._loading.set(true);
    this._loadFailed.set(false);
    this._now.set(new Date());

    try {
      const tenantId = await this.resolveTenant();
      if (!tenantId) return;

      const rows = await this.supabase.run<LeadRow[]>(
        this.supabase.client
          .from('leads')
          .select(SELECT)
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false }) as never,
      );

      this._leads.set((rows ?? []).map((row) => this.toLead(row)));
      this._loaded.set(true);
    } catch (error) {
      this._loadFailed.set(true);
      this.report(error, false);
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * The tenant the user is working in. Access control is RLS, not this value — it
   * scopes the query so a multi-tenant member sees one pipeline at a time.
   */
  private async resolveTenant(): Promise<string | null> {
    const known = this._tenantId();
    if (known) return known;

    const rows = await this.supabase.run<{ tenant_id: string }[]>(
      this.supabase.client.from('memberships').select('tenant_id').limit(1) as never,
    );
    const tenantId = rows?.[0]?.tenant_id ?? null;
    this._tenantId.set(tenantId);
    return tenantId;
  }

  /** Folds the embedded child rows into the shape the dashboard reasons about. */
  private toLead(row: LeadRow): Lead {
    const activities: Activity[] = (row.activities ?? [])
      .map((a) => ({
        id: a.id,
        type: a.type,
        body: a.body,
        occurredAt: new Date(a.occurred_at),
      }))
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    const answers: ChecklistAnswers = {};
    for (const answer of row.qualification_answers ?? []) answers[answer.item] = answer.answer;

    const touches = activities.map((a) => a.occurredAt);

    const openReminder = (row.reminders ?? [])
      .filter((r) => r.done_at === null)
      .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())[0];

    const updatedAt = new Date(row.updated_at);
    const closedToday =
      (row.status === 'won' || row.status === 'lost') &&
      daysBetween(updatedAt, new Date()) === 0;

    return {
      id: row.id,
      name: row.name,
      company: row.company,
      email: row.email,
      phone: row.phone,
      source: row.source,
      status: row.status,
      estimatedValue: Number(row.estimated_value ?? 0),
      lostReason: row.lost_reason,
      isDemo: row.is_demo,
      assignedTo: row.assigned_to,
      createdAt: new Date(row.created_at),
      lastTouchAt: touches[0] ?? null,
      reminderDueAt: openReminder ? new Date(openReminder.due_at) : null,
      reminderTitle: openReminder?.title ?? null,
      checklistAnswered: Object.keys(answers).length,
      answers,
      activities,
      clearedToday: closedToday ? COPY.notify.stageMoved('', row.status) : null,
    };
  }

  /* ---------- derivation ---------- */

  ageInDays(lead: Lead, now = this._now()): number {
    return daysBetween(lead.lastTouchAt ?? lead.createdAt, now);
  }

  attentionOf(lead: Lead, now = this._now()): Attention {
    if (lead.clearedToday !== null) return 'none';
    const reason = this.openReason(lead, now);
    if (reason && reason !== 'drifting') return 'now';
    if (reason === 'drifting') return 'drift';
    return 'none';
  }

  private openReason(lead: Lead, now: Date): OpenReason | null {
    if (lead.status === 'won' || lead.status === 'lost') return null;

    if (lead.reminderDueAt && daysBetween(lead.reminderDueAt, now) >= 0) {
      return 'reminder_due';
    }
    if (lead.status === 'proposal_sent' && this.ageInDays(lead, now) >= DRIFT_DAYS.proposal_sent) {
      return 'proposal_silent';
    }
    if (lead.status === 'new' && lead.checklistAnswered === 0 && this.ageInDays(lead, now) >= 1) {
      return 'unqualified';
    }
    if (this.ageInDays(lead, now) >= DRIFT_DAYS[lead.status]) {
      return 'drifting';
    }
    return null;
  }

  openChecklistCount(lead: Lead): number {
    return CHECKLIST_ITEMS.length - lead.checklistAnswered;
  }

  /* ---------- view state ---------- */

  setSearch(term: string): void {
    this.search.set(term);
  }

  setStatusFilter(status: LeadStatus | 'all'): void {
    this.statusFilter.set(status);
  }

  setSort(key: SortKey): void {
    this.sort.set(key);
  }

  setView(view: DashboardView): void {
    this.view.set(view);
  }

  clearFilters(): void {
    this.search.set('');
    this.statusFilter.set('all');
  }

  toggleSheet(): void {
    this.sheetExpanded.update((v) => !v);
  }

  dismissExplainer(): void {
    this.explainerDismissed.set(true);
  }

  /* ---------- mutations ---------- */

  /**
   * Stage moves are never blocked by the checklist. A DB trigger appends the
   * `status_changed` activity, so this writes the status and nothing else.
   */
  moveToStage(leadId: string, status: LeadStatus, statusLabel: string): void {
    const lead = this.byId(leadId);
    if (!lead || lead.status === status) return;

    void this.commit(
      lead.name,
      () =>
        this.supabase.run(
          this.supabase.client.from('leads').update({ status }).eq('id', leadId) as never,
        ),
      () => {
        this.announcement.set(COPY.a11y.stageChanged(lead.name, statusLabel));
        const open = this.openChecklistCount(lead);
        if (open > 0 && status !== 'won' && status !== 'lost') {
          this.notify.nudge(COPY.nudge.checklist(open), COPY.nudge.later);
        } else {
          this.notify.info(STATUS_GUIDANCE[status]);
        }
      },
    );
  }

  /** Logging contact writes an activity; last-contact is derived from it on reload. */
  /** Returns whether it landed, so a caller can show a busy state and wait for it. */
  logActivity(leadId: string, note: string): Promise<boolean> {
    const lead = this.byId(leadId);
    if (!lead) return Promise.resolve(false);

    return this.commit(
      lead.name,
      async () => {
        const tenantId = await this.requireTenant();
        await this.supabase.run(
          this.supabase.client.from('activities').insert({
            lead_id: leadId,
            tenant_id: tenantId,
            type: 'note',
            body: note,
          }) as never,
        );
        await this.closeOpenReminders(leadId);
      },
      () => this.notify.succeeded(COPY.notify.activityLogged),
    );
  }

  /** Pushes the follow-up to tomorrow. Creates one if the lead has none open. */
  snooze(leadId: string): Promise<boolean> {
    const lead = this.byId(leadId);
    if (!lead) return Promise.resolve(false);
    const tomorrow = new Date(this._now().getTime() + 86_400_000).toISOString();

    return this.commit(
      lead.name,
      async () => {
        const tenantId = await this.requireTenant();
        const open = await this.supabase.run<{ id: string }[]>(
          this.supabase.client
            .from('reminders')
            .select('id')
            .eq('lead_id', leadId)
            .is('done_at', null)
            .limit(1) as never,
        );

        if (open?.length) {
          await this.supabase.run(
            this.supabase.client
              .from('reminders')
              .update({ due_at: tomorrow })
              .eq('id', open[0].id) as never,
          );
        } else {
          await this.supabase.run(
            this.supabase.client.from('reminders').insert({
              lead_id: leadId,
              tenant_id: tenantId,
              title: COPY.notify.snoozed,
              due_at: tomorrow,
              // Every reminder records who scheduled it, on all three write paths — this
              // one, RemindersStore.create, and save_lead's auth.uid(). It cannot be
              // backfilled later without inventing history.
              assigned_to: this.supabase.user()?.id ?? null,
            }) as never,
          );
        }
      },
      () => this.notify.succeeded(COPY.notify.snoozed),
    );
  }

  remove(leadId: string): void {
    const lead = this.byId(leadId);
    if (!lead) return;

    void this.commit(
      lead.name,
      () =>
        this.supabase.run(
          this.supabase.client.from('leads').delete().eq('id', leadId) as never,
        ),
      () => this.notify.succeeded(COPY.notify.leadDeleted),
    );
  }

  /**
   * Creates a lead through the create_lead RPC and returns its id, or null if the
   * write did not happen. One statement, so atomicity is trivial here — it matters
   * on save, where three tables are involved.
   */
  async createLead(draft: LeadDraft): Promise<string | null> {
    if (!this.notify.online()) {
      this.notify.blockedOffline();
      return null;
    }

    try {
      const tenantId = await this.requireTenant();
      const id = await this.rpc<string>('create_lead', {
        p_tenant_id: tenantId,
        p_name: draft.name,
        p_company: draft.company,
        p_email: draft.email,
        p_phone: draft.phone,
        p_source: draft.source,
        p_status: draft.status,
        p_estimated_value: draft.estimatedValue,
      });
      await this.reload();
      this.notify.succeeded(COPY.lead.created);
      return id;
    } catch (error) {
      // A create that fails leaves nothing behind, and the user still has the form
      // in front of them — so this announces rather than interrupting.
      this.report(error, false);
      return null;
    }
  }

  /**
   * Saves the whole lead — fields, an optional note, and any checklist answers the
   * user touched — through one RPC, so a stage change can never land while the typed
   * note is lost. Runs inside commit(), which keeps the offline block and the
   * severity routing that decides popup versus toast.
   */
  saveLead(leadId: string, draft: LeadDraft, extras: LeadSaveExtras): Promise<boolean> {
    const answers = Object.entries(extras.answers).map(([item, answer]) => ({ item, answer }));

    return this.commit(
      draft.name,
      () =>
        this.rpc<null>('save_lead', {
          p_lead_id: leadId,
          p_name: draft.name,
          p_company: draft.company,
          p_email: draft.email,
          p_phone: draft.phone,
          p_source: draft.source,
          p_status: draft.status,
          p_estimated_value: draft.estimatedValue,
          p_lost_reason: draft.lostReason,
          p_note: extras.note,
          p_note_type: extras.noteType,
          p_answers: answers,
          // Reminder intent travels with the same save, so a follow-up cannot land
          // while the note beside it is lost.
          p_reminder_action: extras.reminderAction,
          p_reminder_due: extras.reminderDue ? extras.reminderDue.toISOString() : null,
          p_reminder_title: extras.reminderTitle,
        }),
      () => {
        this.notify.succeeded(COPY.lead.saved);
        const before = this.byId(leadId);
        if (before && before.status !== draft.status) {
          this.announcement.set(COPY.a11y.stageChanged(draft.name, STATUS_LABEL[draft.status]));
        }
      },
    );
  }

  private async closeOpenReminders(leadId: string): Promise<void> {
    await this.supabase.run(
      this.supabase.client
        .from('reminders')
        .update({ done_at: new Date().toISOString() })
        .eq('lead_id', leadId)
        .is('done_at', null) as never,
    );
  }

  /* ---------- the write path ---------- */

  /**
   * Every mutation goes through here, so the notification rules live in one place.
   *
   * Offline blocks rather than queues: the banner already says changes will not save,
   * and accepting a write we cannot honour would mean showing the user a lead that does
   * not exist. Nothing is attempted, so nothing is lost — that is a toast, not the popup.
   *
   * On success the pipeline is re-read rather than patched locally: derived fields
   * (last contact, open reminder, checklist progress) live in three other tables and a
   * trigger writes one of them, so the server's answer is the only trustworthy one.
   */
  private async commit(
    subject: string,
    write: () => Promise<unknown>,
    onSuccess?: () => void,
  ): Promise<boolean> {
    if (!this.notify.online()) {
      this.notify.blockedOffline();
      return false;
    }

    const run = async () => {
      await write();
      await this.reload();
    };

    try {
      await run();
      onSuccess?.();
      return true;
    } catch (error) {
      this.report(error, true, subject, run);
      return false;
    }
  }

  /** Re-reads without the loading guard, so it can follow a write. */
  private async reload(): Promise<void> {
    const tenantId = await this.requireTenant();
    const rows = await this.supabase.run<LeadRow[]>(
      this.supabase.client
        .from('leads')
        .select(SELECT)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }) as never,
    );
    this._now.set(new Date());
    this._leads.set((rows ?? []).map((row) => this.toLead(row)));
  }

  /**
   * One place that turns a thrown error into the right mechanism. `costsData` in
   * SupabaseService owns the severity rule; this only routes what it decides.
   */
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

  /**
   * Calls a Postgres function. The generated Database types are regenerated from the
   * schema and do not yet know these two, so the name is widened here rather than
   * scattering casts through the call sites. Regenerating the types removes this.
   */
  private rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const client = this.supabase.client as unknown as {
      rpc: (name: string, params: Record<string, unknown>) => unknown;
    };
    return this.supabase.run<T>(client.rpc(fn, args) as never);
  }

  private async requireTenant(): Promise<string> {
    const tenantId = await this.resolveTenant();
    if (!tenantId) {
      throw { message: COPY.errors.notAllowed, code: '42501', cause: null } satisfies AppError;
    }
    return tenantId;
  }

  private byId(leadId: string): Lead | undefined {
    return this._leads().find((l) => l.id === leadId);
  }
}
