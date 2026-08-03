import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';

import { COPY, OPEN_REASON, daysBetween } from './copy';
import { Lead, LeadStatus, OpenItem, OpenReason } from './lead.model';
import { LeadsStore } from './leads.store';
import { NotifyService } from './notify.service';
import { AppError, SupabaseService, costsData, isAppError } from './supabase.service';

/** One open reminder, with the lead it belongs to. */
export interface Reminder {
  id: string;
  leadId: string;
  leadName: string;
  leadStatus: LeadStatus;
  title: string | null;
  dueAt: Date;
}

/** A lead the pipeline thinks needs attention, with no reminder row of its own. */
export interface Suggestion {
  lead: Lead;
  reason: OpenReason;
  age: number;
}

/**
 * How many suggestions the band shows. A judgement call, like the 10-decided threshold on
 * insights: enough to be useful, few enough that the band cannot nag. A suggestion that
 * nags is a gate wearing a different coat.
 */
export const SUGGESTION_CAP = 5;

export type ReminderBand = 'overdue' | 'today' | 'upcoming';

/**
 * Which band a due date falls in.
 *
 * A pure function rather than three inline filters, because the interesting cases are all
 * at the calendar-day boundary — 23:50 and 00:10 on either side of midnight — and those
 * are only cheap to test when `now` is an argument instead of a clock reading. It uses the
 * same UTC-normalised helper as openReason(): two definitions of "today" in one product is
 * a bug that surfaces exactly once a day, at the worst moment.
 */
export function bandOf(dueAt: Date, now: Date): ReminderBand {
  const days = daysBetween(dueAt, now);
  if (days > 0) return 'overdue';
  if (days === 0) return 'today';
  return 'upcoming';
}

/**
 * The suggestions band: leads the pipeline flags that carry no reminder of their own.
 *
 * Pure for the same reason as bandOf — the exclusion rule is the whole point of the band
 * (a lead the user already scheduled must not also be suggested to them), and it is worth
 * asserting without a Supabase client in the room.
 */
export function deriveSuggestions(openItems: OpenItem[], rows: Reminder[]): Suggestion[] {
  const withReminder = new Set(rows.map((r) => r.leadId));
  return openItems
    .filter((item) => !withReminder.has(item.lead.id) && item.lead.reminderDueAt === null)
    .map((item) => ({ lead: item.lead, reason: item.reason, age: item.age }))
    .sort((a, b) => b.age - a.age);
}

interface ReminderRow {
  id: string;
  title: string | null;
  due_at: string;
  lead_id: string;
  leads: { id: string; name: string; status: LeadStatus } | null;
}

/**
 * The explicit reminders — rows a person scheduled, which can be completed and moved.
 *
 * Separate from LeadsStore on purpose: that store is the dashboard's pipeline and is
 * already large, and the masthead badge has to be right on /insights and /profile where
 * the pipeline may never have loaded at all.
 */
@Injectable({ providedIn: 'root' })
export class RemindersStore {
  private readonly supabase = inject(SupabaseService);
  private readonly notify = inject(NotifyService);
  private readonly leads = inject(LeadsStore);

  private readonly _rows = signal<Reminder[]>([]);
  private readonly _now = signal(new Date());
  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);
  private readonly _failed = signal(false);
  private readonly _busyId = signal<string | null>(null);

  constructor() {
    // Sign-out empties this store for the same reason it empties the pipeline: a root
    // singleton would otherwise hand the next user the previous one's follow-ups, and the
    // masthead badge would count them. Epoch 0 is the initial value, not a sign-out.
    effect(() => {
      if (this.supabase.sessionEpoch() > 0) untracked(() => this.reset());
    });
  }

  reset(): void {
    this._rows.set([]);
    this._loaded.set(false);
    this._failed.set(false);
    this._loading.set(false);
    this._busyId.set(null);
  }

  readonly rows = this._rows.asReadonly();
  readonly now = this._now.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly failed = this._failed.asReadonly();
  readonly busyId = this._busyId.asReadonly();

  readonly overdue = computed(() =>
    this._rows()
      .filter((r) => bandOf(r.dueAt, this._now()) === 'overdue')
      // most overdue first, matching every other urgency surface
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime()),
  );

  readonly today = computed(() =>
    this._rows().filter((r) => bandOf(r.dueAt, this._now()) === 'today'),
  );

  /** The only forward-looking list in the product, and the reason to open this screen. */
  readonly upcoming = computed(() =>
    this._rows()
      .filter((r) => bandOf(r.dueAt, this._now()) === 'upcoming')
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime()),
  );

  /**
   * The badge. Scheduled work only — five drifting leads produce no badge, because
   * nothing is scheduled. The bell is the user's own calendar; pipeline attention
   * already has three surfaces of its own.
   */
  readonly openCount = computed(() => this.overdue().length + this.today().length);

  /** Leads the pipeline flags that have no reminder row. Never counted in the badge. */
  readonly allSuggestions = computed<Suggestion[]>(() =>
    deriveSuggestions(this.leads.openItems(), this._rows()),
  );

  readonly suggestions = computed(() => this.allSuggestions().slice(0, SUGGESTION_CAP));
  readonly suggestionsTruncated = computed(
    () => this.allSuggestions().length > SUGGESTION_CAP,
  );

  readonly isEmpty = computed(
    () => this._rows().length === 0 && this.allSuggestions().length === 0,
  );

  /* ---------- read ---------- */

  async load(): Promise<void> {
    if (this._loading()) return;
    this._loading.set(true);
    this._failed.set(false);
    this._now.set(new Date());

    try {
      const tenantId = await this.tenantId();
      const rows = await this.supabase.run<ReminderRow[]>(
        this.supabase.client
          .from('reminders')
          .select('id, title, due_at, lead_id, leads ( id, name, status )')
          .eq('tenant_id', tenantId)
          .is('done_at', null)
          // ascending on purpose, and the only list here that sorts that way: the answer
          // to "what is next" is the soonest, so it is still the first row
          .order('due_at', { ascending: true }) as never,
      );

      this._rows.set(
        (rows ?? [])
          .filter((row) => row.leads !== null)
          .map((row) => ({
            id: row.id,
            leadId: row.lead_id,
            leadName: row.leads!.name,
            leadStatus: row.leads!.status,
            title: row.title,
            dueAt: new Date(row.due_at),
          })),
      );
      this._loaded.set(true);
    } catch (error) {
      this._failed.set(true);
      this.report(error, false);
    } finally {
      this._loading.set(false);
    }
  }

  /* ---------- writes ---------- */

  complete(id: string): Promise<boolean> {
    const row = this.byId(id);
    if (!row) return Promise.resolve(false);

    return this.commit(
      id,
      row.leadName,
      () =>
        this.supabase.run(
          this.supabase.client
            .from('reminders')
            .update({ done_at: new Date().toISOString() })
            .eq('id', id) as never,
        ),
      () => this.notify.succeeded(COPY.notify.reminderDone),
    );
  }

  reschedule(id: string, due: Date): Promise<boolean> {
    const row = this.byId(id);
    if (!row) return Promise.resolve(false);
    if (this.isPast(due)) {
      // `min` on the input is a hint, not a validator.
      this.notify.failed(COPY.reminders.pastDate);
      return Promise.resolve(false);
    }

    return this.commit(
      id,
      row.leadName,
      () =>
        this.supabase.run(
          this.supabase.client
            .from('reminders')
            .update({ due_at: due.toISOString() })
            .eq('id', id) as never,
        ),
      () => this.notify.succeeded(COPY.notify.reminderMoved(this.dayLabel(due))),
    );
  }

  /**
   * One open reminder per lead is the working assumption: the day sheet, the badge and
   * the attention rules all reason about "the" open reminder. Setting one while another
   * is open reschedules that one rather than creating a second. The table permits many,
   * so nothing here blocks multi-reminder later — but v1 does not open that door.
   */
  async create(leadId: string, title: string | null, due: Date): Promise<boolean> {
    if (this.isPast(due)) {
      this.notify.failed(COPY.reminders.pastDate);
      return false;
    }

    const existing = this._rows().find((r) => r.leadId === leadId);
    if (existing) return this.reschedule(existing.id, due);

    const lead = this.leads.leads().find((l) => l.id === leadId);
    return this.commit(
      leadId,
      lead?.name ?? '',
      async () => {
        const tenantId = await this.tenantId();
        // The generated types have `title` as non-nullable on insert, though the column
        // allows null. Widened rather than substituting '' — an empty title and no title
        // are different facts, and the row falls back to the reason when it is absent.
        const payload = {
          lead_id: leadId,
          tenant_id: tenantId,
          title,
          due_at: due.toISOString(),
          // Recorded from the start so history is not empty when invites land (8.3).
          assigned_to: this.supabase.user()?.id ?? null,
        } as never;

        await this.supabase.run(this.supabase.client.from('reminders').insert(payload) as never);
      },
      () => this.notify.succeeded(COPY.notify.reminderSet(this.dayLabel(due))),
    );
  }

  /** Distinct from complete: "I did it" and "this should never have existed" differ. */
  remove(id: string): Promise<boolean> {
    const row = this.byId(id);
    if (!row) return Promise.resolve(false);

    return this.commit(
      id,
      row.leadName,
      () =>
        this.supabase.run(
          this.supabase.client.from('reminders').delete().eq('id', id) as never,
        ),
      () => this.notify.succeeded(COPY.notify.reminderRemoved),
    );
  }

  /* ---------- plumbing ---------- */

  /**
   * Same shape as LeadsStore.commit: offline blocks, severity routes the failure, and a
   * success re-reads rather than patching locally. It also refreshes the pipeline, because
   * completing a reminder changes what the day sheet and the attention flags show.
   */
  private async commit(
    busyKey: string,
    subject: string,
    write: () => Promise<unknown>,
    onSuccess?: () => void,
  ): Promise<boolean> {
    if (!this.notify.online()) {
      this.notify.blockedOffline();
      return false;
    }

    this._busyId.set(busyKey);
    const run = async () => {
      await write();
      await this.reload();
      await this.leads.load();
    };

    try {
      await run();
      onSuccess?.();
      return true;
    } catch (error) {
      this.report(error, true, subject, run);
      return false;
    } finally {
      this._busyId.set(null);
    }
  }

  private async reload(): Promise<void> {
    const tenantId = await this.tenantId();
    const rows = await this.supabase.run<ReminderRow[]>(
      this.supabase.client
        .from('reminders')
        .select('id, title, due_at, lead_id, leads ( id, name, status )')
        .eq('tenant_id', tenantId)
        .is('done_at', null)
        .order('due_at', { ascending: true }) as never,
    );
    this._now.set(new Date());
    this._rows.set(
      (rows ?? [])
        .filter((row) => row.leads !== null)
        .map((row) => ({
          id: row.id,
          leadId: row.lead_id,
          leadName: row.leads!.name,
          leadStatus: row.leads!.status,
          title: row.title,
          dueAt: new Date(row.due_at),
        })),
    );
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

  private byId(id: string): Reminder | undefined {
    return this._rows().find((r) => r.id === id);
  }

  /** A date earlier than today's calendar day. Same day-granularity as everything else. */
  private isPast(due: Date): boolean {
    return bandOf(due, this._now()) === 'overdue';
  }

  private dayLabel(due: Date): string {
    return due.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
  }

  /** Falls back to the reason the pipeline already has words for, never an empty element. */
  titleFor(reminder: Reminder): string {
    if (reminder.title && reminder.title.trim().length > 0) return reminder.title;
    return COPY.reminders.setReminder;
  }

  reasonLabel(reason: OpenReason): string {
    return OPEN_REASON[reason];
  }

  private async tenantId(): Promise<string> {
    const known = this.leads.tenantId();
    if (known) return known;

    const rows = await this.supabase.run<{ tenant_id: string }[]>(
      this.supabase.client.from('memberships').select('tenant_id').limit(1) as never,
    );
    const id = rows?.[0]?.tenant_id;
    if (!id) throw { message: COPY.errors.notAllowed, code: '42501', cause: null } satisfies AppError;
    return id;
  }
}
