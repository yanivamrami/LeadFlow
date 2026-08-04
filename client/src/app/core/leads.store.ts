import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';

import { ageInDays, openReasonFor } from './attention';
import { COPY, daysBetween, formatDue } from './copy';
import {
  Activity,
  ActivityType,
  Attention,
  CHECKLIST_ITEMS,
  ChecklistAnswers,
  ChecklistItem,
  Lead,
  LeadDraft,
  LeadSaveExtras,
  LeadSource,
  OPEN_ITEMS_CAP,
  OpenItem,
  QualificationAnswer,
  SortKey,
  Stage,
} from './lead.model';
import { NotifyService } from './notify.service';
import { StagesStore } from './stages.store';
import { AppError, SupabaseService, costsData, isAppError } from './supabase.service';

export type DashboardView = 'list' | 'board';

/**
 * Activity types that count as having actually reached the person, and therefore close an
 * open follow-up. `note` is deliberately absent: "he asked me to call back next week" is a
 * record of intent, not of contact. Mirrors the gate inside the `save_lead` RPC — if one
 * side changes, the other must too, or the same act clears the reminder from one screen
 * and leaves it open from another.
 */
const CONTACT_TYPES: readonly ActivityType[] = ['call', 'email', 'meeting'];

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
  stage_id: string;
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
  id, tenant_id, name, company, email, phone, source, stage_id, estimated_value,
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
  private readonly stages = inject(StagesStore);
  /** Only for the checklist nudge's action, which is a navigation and nothing else. */
  private readonly router = inject(Router);

  /** Raw rows as PostgREST returned them — `leads` resolves them against StagesStore. */
  private readonly _rows = signal<LeadRow[]>([]);
  private readonly _now = signal(new Date());
  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);
  private readonly _loadFailed = signal(false);
  private readonly _tenantId = signal<string | null>(null);
  private readonly _writes = signal(0);

  readonly search = signal('');
  readonly sort = signal<SortKey>('urgency');
  readonly stageFilter = signal<string | 'all'>('all');
  /** Arrives from an insights row (`?source=`); validated by the caller before it lands here. */
  readonly sourceFilter = signal<LeadSource | 'all'>('all');
  readonly view = signal<DashboardView>('list');
  readonly sheetExpanded = signal(false);
  readonly explainerDismissed = signal(false);
  /** Announced politely to screen readers after a stage move. */
  readonly announcement = signal('');

  /**
   * Bumped once per lead write that has landed and been re-read. It carries no payload on
   * purpose — it is a "the server's answer for this tenant's leads just changed" signal, not
   * a description of what changed, so a listener re-reads its own table rather than trying to
   * patch itself from a diff it was not given.
   *
   * `RemindersStore` is the reason it exists: several writes here move rows in `reminders`
   * without that store being involved at all (see its constructor for the list). Exposed as a
   * signal rather than having this store call `RemindersStore.reload()` because
   * `RemindersStore` already injects *this* store for its suggestions — the reverse injection
   * would close the cycle.
   */
  readonly writeTick = this._writes.asReadonly();

  /**
   * Folded against whatever StagesStore currently holds, rather than at fetch time — a
   * plain computed, so a stage rename in the manager updates every lead holding it
   * without a re-read of the pipeline, and so a row whose stage has not arrived yet
   * (StagesStore.load() still in flight) resolves the moment it does, instead of being
   * dropped for the rest of the session. A row that never resolves (a dangling id) is
   * skipped rather than shown with a blank stage — see `toLead`.
   */
  readonly leads = computed<Lead[]>(() =>
    this._rows()
      .map((row) => this.toLead(row))
      .filter((lead): lead is Lead => lead !== null),
  );

  readonly now = this._now.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  /**
   * A read that failed is not an empty pipeline. Without this the register renders
   * "you have no leads yet" over a network error — a lie about the user's own data.
   *
   * It includes the *stages* read, and has to: since `leads` resolves each row against
   * StagesStore and skips what it cannot resolve, a failed stage read with a perfectly
   * good lead read would empty the pipeline and render the empty state over it — the exact
   * failure SCREENS 2.9 was raised for, arriving by a new route. Either read failing means
   * the screen cannot be trusted, so both report through here.
   */
  readonly loadFailed = computed(() => this._loadFailed() || this.stages.loadFailed());
  readonly tenantId = this._tenantId.asReadonly();

  /**
   * Leads narrowed by source alone — the shared base for `total`, `countByStage` and
   * `visibleLeads`, so a source filter arriving from insights stays consistent across
   * every figure the filter row shows, not just the list underneath it.
   */
  private readonly sourceScopedLeads = computed(() => {
    const source = this.sourceFilter();
    return source === 'all' ? this.leads() : this.leads().filter((l) => l.source === source);
  });

  readonly total = computed(() => this.sourceScopedLeads().length);

  /** Keyed by stage id now, not by an enum name — one entry per live stage, in position order. */
  readonly countByStage = computed(() => {
    const counts: Record<string, number> = Object.fromEntries(
      this.stages.active().map((s) => [s.id, 0]),
    );
    for (const lead of this.sourceScopedLeads()) {
      if (lead.stage.id in counts) counts[lead.stage.id]++;
    }
    return counts;
  });

  readonly clearedToday = computed(() => this.leads().filter((l) => l.clearedToday !== null));

  /**
   * Everything owed right now, most-overdue first. Drifting leads are the soft signal:
   * they flag their row in the register but only reach the day sheet when nothing
   * urgent is left — otherwise the sheet stops meaning "today" and starts meaning "someday".
   */
  readonly openItems = computed<OpenItem[]>(() => {
    const now = this._now();
    const items: OpenItem[] = [];

    for (const lead of this.leads()) {
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
    const stageId = this.stageFilter();
    const key = this.sort();
    const now = this._now();

    return this.sourceScopedLeads()
      .filter((lead) => stageId === 'all' || lead.stage.id === stageId)
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
    () =>
      this.stageFilter() !== 'all' ||
      this.sourceFilter() !== 'all' ||
      this.search().trim().length > 0,
  );

  /** One column per live stage, in position order — six today, N once a tenant edits its pipeline. */
  readonly columns = computed(() =>
    this.stages.active().map((stage) => ({
      stage,
      leads: this.visibleLeads().filter((lead) => lead.stage.id === stage.id),
    })),
  );

  constructor() {
    // Sign-out must empty this store. It is a root singleton, so otherwise the next user
    // to sign in on this browser inherits the previous one's pipeline on screen, and the
    // cached tenant id sends their first query to the wrong tenant. Skips epoch 0, which
    // is the initial value and not a sign-out.
    effect(() => {
      if (this.supabase.sessionEpoch() > 0) untracked(() => this.reset());
    });
  }

  /** Back to the state a fresh load starts from. Filters and view preferences go too. */
  reset(): void {
    this._rows.set([]);
    this._tenantId.set(null);
    this._loaded.set(false);
    this._loadFailed.set(false);
    this._loading.set(false);
    this._writes.set(0);
    this.search.set('');
    this.stageFilter.set('all');
    this.sourceFilter.set('all');
    this.sort.set('urgency');
    this.sheetExpanded.set(false);
    this.announcement.set('');
  }

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

      // Stages resolve every lead's `stage_id` in `leads` (the computed above), so they
      // must be in flight before — or at least alongside — the rows themselves. Awaited
      // rather than raced: if another caller already started this load, the guard inside
      // StagesStore.load() makes this call a no-op, but `leads` still resolves correctly
      // the moment that other call finishes, because it is a computed over both signals.
      await this.stages.load();

      const rows = await this.supabase.run<LeadRow[]>(
        this.supabase.client
          .from('leads')
          .select(SELECT)
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false }) as never,
      );

      this._rows.set(rows ?? []);
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

  /**
   * Folds one raw row into the shape the dashboard reasons about. Returns `null` when the
   * row's stage cannot be resolved — in practice only a transient state while StagesStore's
   * own load is still in flight, since the database FK guarantees `stage_id` always points
   * at a real row in the lead's own tenant. `leads` filters these out rather than showing a
   * blank stage; the computed re-runs and picks the lead back up the moment stages arrive.
   */
  private toLead(row: LeadRow): Lead | null {
    const stage = this.stages.byId(row.stage_id);
    if (!stage) return null;

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
    const closedToday = stage.kind !== 'open' && daysBetween(updatedAt, new Date()) === 0;

    return {
      id: row.id,
      name: row.name,
      company: row.company,
      email: row.email,
      phone: row.phone,
      source: row.source,
      stage,
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
      clearedToday: closedToday ? COPY.notify.stageMoved('', stage.name) : null,
    };
  }

  /* ---------- derivation ---------- */

  /**
   * Both of these now delegate to `core/guidance.ts`. The rules moved out of this store
   * unchanged, because the lead sheet needs the same answer and `openReason` was private —
   * so the screen where a beginner asks "what now?" could not reach what the day sheet was
   * already computing. One rule, one place, two screens.
   */
  ageInDays(lead: Lead, now = this._now()): number {
    return ageInDays(lead, now);
  }

  attentionOf(lead: Lead, now = this._now()): Attention {
    if (lead.clearedToday !== null) return 'none';
    const reason = this.openReason(lead, now);
    if (reason && reason !== 'drifting') return 'now';
    if (reason === 'drifting') return 'drift';
    return 'none';
  }

  /** Thin wrapper over the pure rule in core/attention.ts, supplying the one thing it
   *  cannot know on its own: which live stage new leads land in. */
  private openReason(lead: Lead, now: Date) {
    return openReasonFor(lead, now, this.stages.firstOpen()?.id ?? null);
  }


  openChecklistCount(lead: Lead): number {
    return CHECKLIST_ITEMS.length - lead.checklistAnswered;
  }

  /* ---------- view state ---------- */

  setSearch(term: string): void {
    this.search.set(term);
  }

  setStageFilter(stageId: string | 'all'): void {
    this.stageFilter.set(stageId);
  }

  /** Invalid or absent values are the caller's job to catch; `'all'` is always safe here. */
  setSourceFilter(source: LeadSource | 'all'): void {
    this.sourceFilter.set(source);
  }

  setSort(key: SortKey): void {
    this.sort.set(key);
  }

  setView(view: DashboardView): void {
    this.view.set(view);
  }

  clearFilters(): void {
    this.search.set('');
    this.stageFilter.set('all');
    this.sourceFilter.set('all');
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
   * `status_changed` activity, so this writes the stage and nothing else.
   */
  moveToStage(leadId: string, stage: Stage): void {
    const lead = this.byId(leadId);
    if (!lead || lead.stage.id === stage.id) return;

    void this.commit(
      lead.name,
      () =>
        this.supabase.run(
          this.supabase.client
            .from('leads')
            // stage_id is not yet in the generated Database types (see rpc()'s doc
            // comment below) — widened the same way, on the value rather than the table.
            .update({ stage_id: stage.id } as never)
            .eq('id', leadId) as never,
        ),
      () => {
        this.announcement.set(COPY.a11y.stageChanged(lead.name, stage.name));
        const open = this.openChecklistCount(lead);
        if (open > 0 && stage.kind === 'open') {
          // The action opens the lead at its checklist. It never answers anything — that is
          // why it waited for the checklist to have a screen rather than shipping as a
          // one-tap "mark done", which would have been a lie about the user's own data.
          this.notify.nudge(COPY.nudge.checklist(open), COPY.nudge.later, {
            label: COPY.nudge.fillNow,
            run: () =>
              void this.router.navigate(['/lead', leadId], {
                queryParams: { at: 'checklist' },
              }),
          });
        } else if (stage.guidance) {
          // A user-created stage may carry no guidance at all (documents/PLAN-stages.md
          // §4.4) — silence is the right answer there, not a blank toast.
          this.notify.info(stage.guidance);
        }
      },
    );
  }

  /**
   * Logs contact. `type` is the truthful record; `body` is optional so a caller can log
   * that something concrete happened (a call) without inventing a sentence to justify
   * it — the timestamp and the type carry the fact. Last-contact is derived from this
   * on reload. Returns whether it landed, so a caller can show a busy state and wait.
   */
  logActivity(leadId: string, type: ActivityType, body: string | null = null): Promise<boolean> {
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
            type,
            body,
          }) as never,
        );
        // Only real contact clears a follow-up. `save_lead` applies the same three types
        // to the note it writes, so the two entry points cannot disagree about what
        // "I dealt with this" means — writing an internal note is not dealing with it.
        if (CONTACT_TYPES.includes(type)) await this.closeOpenReminders(leadId);
      },
      () => this.notify.succeeded(COPY.notify.activityLogged),
    );
  }

  /**
   * Moves the follow-up to the chosen day. Creates one if the lead has none open.
   * `due`'s `min` on the picker's input is only a hint, so a past day is refused here
   * too — the same rule RemindersStore.reschedule already enforces for its own picker.
   */
  snooze(leadId: string, due: Date): Promise<boolean> {
    const lead = this.byId(leadId);
    if (!lead) return Promise.resolve(false);
    if (daysBetween(due, this._now()) > 0) {
      this.notify.failed(COPY.reminders.pastDate);
      return Promise.resolve(false);
    }
    const dueIso = due.toISOString();

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
              .update({ due_at: dueIso })
              .eq('id', open[0].id) as never,
          );
        } else {
          // The generated types have `title` as non-nullable on insert, though the column
          // allows null — same widening RemindersStore.create uses, for the same reason.
          // No title invents no reason: the day picker lands on any date the user chose,
          // not always tomorrow, so a fixed "נדחה למחר" would misstate every other day.
          // The reminders list falls back to its own generic label (RemindersStore.titleFor)
          // when title is null.
          const payload = {
            lead_id: leadId,
            tenant_id: tenantId,
            title: null,
            due_at: dueIso,
            // Every reminder records who scheduled it, on all three write paths — this
            // one, RemindersStore.create, and save_lead's auth.uid(). It cannot be
            // backfilled later without inventing history.
            assigned_to: this.supabase.user()?.id ?? null,
          } as never;

          await this.supabase.run(this.supabase.client.from('reminders').insert(payload) as never);
        }
      },
      () => this.notify.succeeded(COPY.notify.reminderMoved(formatDue(due, this._now()))),
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
        p_stage_id: draft.stageId,
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
          p_stage_id: draft.stageId,
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
        if (before && before.stage.id !== draft.stageId) {
          const stageName = this.stages.byId(draft.stageId)?.name ?? '';
          this.announcement.set(COPY.a11y.stageChanged(draft.name, stageName));
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
      // After the re-read, not before: a listener woken by this tick must find this store
      // already holding the server's new answer, not the one it is about to replace.
      this._writes.update((n) => n + 1);
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
    this._rows.set(rows ?? []);
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
    return this.leads().find((l) => l.id === leadId);
  }
}
