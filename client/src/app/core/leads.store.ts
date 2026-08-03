import { Injectable, computed, inject, signal } from '@angular/core';

import { DEMO_LEADS } from './demo-leads';
import { COPY, STATUS_GUIDANCE } from './copy';
import { ServerError, mapError } from './error-map';
import { NotifyService } from './notify.service';
import {
  Attention,
  CHECKLIST_ITEMS,
  DRIFT_DAYS,
  Lead,
  LeadStatus,
  OPEN_ITEMS_CAP,
  OpenItem,
  OpenReason,
  STAGE_ORDER,
} from './lead.model';
import { daysBetween } from './copy';

export type DashboardView = 'list' | 'board';

/**
 * Dashboard state. Signals only — the app is small enough that NgRx would be ceremony
 * (docs/ARCHITECTURE.md §4). Server becomes the source of truth when Supabase lands;
 * every mutation here is already shaped as an optimistic local write.
 */
@Injectable({ providedIn: 'root' })
export class LeadsStore {
  private readonly notify = inject(NotifyService);

  private readonly _leads = signal<Lead[]>(DEMO_LEADS);
  /** Captured once so a long-lived tab doesn't recompute "today" on every read. */
  private readonly _now = signal(new Date());

  readonly search = signal('');
  readonly statusFilter = signal<LeadStatus | 'all'>('all');
  readonly view = signal<DashboardView>('list');
  readonly sheetExpanded = signal(false);
  readonly explainerDismissed = signal(false);
  /** Announced politely to screen readers after a stage move. */
  readonly announcement = signal('');

  readonly leads = this._leads.asReadonly();
  readonly now = this._now.asReadonly();

  readonly total = computed(() => this._leads().length);

  readonly countByStatus = computed(() => {
    const counts = Object.fromEntries(STAGE_ORDER.map((s) => [s, 0])) as Record<
      LeadStatus,
      number
    >;
    for (const lead of this._leads()) counts[lead.status]++;
    return counts;
  });

  /** Cleared today — kept visible, struck through, until the day rolls over. */
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

  /** Register contents: filter, then search, then rank by urgency. */
  readonly visibleLeads = computed(() => {
    const term = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    const now = this._now();

    const rank: Record<Attention, number> = { now: 0, drift: 1, none: 2 };

    return this._leads()
      .filter((lead) => status === 'all' || lead.status === status)
      .filter((lead) => {
        if (!term) return true;
        return [lead.name, lead.company, lead.phone, lead.email]
          .filter((v): v is string => !!v)
          .some((v) => v.toLowerCase().includes(term));
      })
      .sort((a, b) => {
        const byAttention =
          rank[this.attentionOf(a, now)] - rank[this.attentionOf(b, now)];
        if (byAttention !== 0) return byAttention;
        return this.ageInDays(b, now) - this.ageInDays(a, now);
      });
  });

  readonly isFiltered = computed(
    () => this.statusFilter() !== 'all' || this.search().trim().length > 0,
  );

  readonly columns = computed(() =>
    STAGE_ORDER.map((status) => ({
      status,
      leads: this.visibleLeads().filter((lead) => lead.status === status),
    })),
  );

  /* ---------- derivation ---------- */

  /** Days since the last thing that counts as contact. */
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

  /**
   * Why a lead needs the user, in priority order. `drifting` is the soft signal —
   * it flags the row but does not claim the day sheet unless nothing else does.
   */
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

  /* ---------- mutations ---------- */

  setSearch(term: string): void {
    this.search.set(term);
  }

  setStatusFilter(status: LeadStatus | 'all'): void {
    this.statusFilter.set(status);
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

  /**
   * Stage moves are never blocked by the checklist. If questions are still open the move
   * still happens and a dismissible nudge follows it — a teaching moment, not a gate.
   */
  moveToStage(leadId: string, status: LeadStatus, statusLabel: string): void {
    const lead = this._leads().find((l) => l.id === leadId);
    if (!lead || lead.status === status) return;

    void this.commit(
      lead.name,
      () => {
        this.patch(leadId, (l) => ({
          ...l,
          status,
          lastTouchAt: new Date(),
          reminderDueAt: null,
          reminderTitle: null,
          clearedToday: status === 'won' || status === 'lost' ? statusLabel : l.clearedToday,
        }));
        this.announcement.set(COPY.a11y.stageChanged(lead.name, statusLabel));
      },
      () => {
        const open = this.openChecklistCount(lead);
        if (open > 0 && status !== 'won' && status !== 'lost') {
          this.notify.nudge(
            COPY.nudge.checklist(open),
            { label: COPY.nudge.fillNow, run: () => this.answerChecklist(leadId) },
            COPY.nudge.later,
          );
        } else {
          this.notify.info(STATUS_GUIDANCE[status]);
        }
      },
    );
  }

  /** Logging contact resets the clock and clears the item off today's sheet. */
  logActivity(leadId: string, note: string): void {
    const lead = this.byId(leadId);
    if (!lead) return;
    void this.commit(
      lead.name,
      () => {
        this.patch(leadId, (l) => ({
          ...l,
          lastTouchAt: new Date(),
          reminderDueAt: null,
          reminderTitle: null,
          clearedToday: note,
        }));
      },
      () => this.notify.succeeded(COPY.notify.activityLogged),
    );
  }

  /** Push a reminder to tomorrow. The item leaves today's sheet and nothing is lost. */
  snooze(leadId: string): void {
    const lead = this.byId(leadId);
    if (!lead) return;
    const tomorrow = new Date(this._now().getTime() + 86_400_000);
    void this.commit(
      lead.name,
      () => {
        this.patch(leadId, (l) => ({
          ...l,
          reminderDueAt: tomorrow,
          reminderTitle: l.reminderTitle ?? COPY.notify.snoozed,
          lastTouchAt: new Date(),
        }));
      },
      () => this.notify.succeeded(COPY.notify.snoozed),
    );
  }

  /** Answering the checklist is what the nudge asks for; it never changes the stage. */
  answerChecklist(leadId: string): void {
    const lead = this.byId(leadId);
    if (!lead) return;
    void this.commit(
      lead.name,
      () => this.patch(leadId, (l) => ({ ...l, checklistAnswered: CHECKLIST_ITEMS.length })),
      () => this.notify.succeeded(COPY.notify.checklistFilled),
    );
  }

  remove(leadId: string): void {
    const lead = this.byId(leadId);
    if (!lead) return;
    void this.commit(
      lead.name,
      () => this._leads.update((leads) => leads.filter((l) => l.id !== leadId)),
      () => this.notify.succeeded(COPY.notify.leadDeleted),
    );
  }

  /* ---------- writes ---------- */

  /**
   * Every mutation goes through here, so the notification rules live in one place.
   *
   * Offline blocks rather than queues: the banner already says changes will not save,
   * and accepting a write we cannot honour would mean showing the user a lead that does
   * not exist. Nothing is attempted, so nothing is lost — that is a toast, not the popup.
   *
   * A write that *is* attempted and fails raises the interrupt with its own retry, which
   * re-runs this exact mutation rather than asking the user to redo it by hand.
   */
  private async commit(
    subject: string,
    apply: () => void,
    onSuccess?: () => void,
  ): Promise<void> {
    if (!this.notify.online()) {
      this.notify.blockedOffline();
      return;
    }

    const run = async () => {
      await this.persist();
      apply();
    };

    try {
      await run();
      onSuccess?.();
    } catch (error) {
      const mapped = mapError(error as ServerError, true);
      if (mapped.costsData) {
        this.notify.failedToPersist({ subject, run }, mapped.code);
      } else {
        this.notify.failed(mapped.message);
      }
    }
  }

  /**
   * The Supabase seam. The store is local until the schema is deployed, so this resolves;
   * swapping in `supabase.from('leads').update(...)` changes this method and nothing else.
   */
  private persist(): Promise<void> {
    return Promise.resolve();
  }

  private byId(leadId: string): Lead | undefined {
    return this._leads().find((l) => l.id === leadId);
  }

  private patch(leadId: string, fn: (lead: Lead) => Lead): void {
    this._leads.update((leads) => leads.map((l) => (l.id === leadId ? fn(l) : l)));
  }
}
