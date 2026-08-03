import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { Lead, OpenItem } from './lead.model';
import { LeadsStore } from './leads.store';
import { NotifyService } from './notify.service';
import { RemindersStore, Reminder, bandOf, deriveSuggestions } from './reminders.store';
import { SupabaseService } from './supabase.service';

/** 09:00 local on the given day — the hour due-picker writes. */
function at(y: number, m: number, d: number, h = 9, min = 0): Date {
  return new Date(y, m - 1, d, h, min);
}

function reminder(id: string, leadId: string, dueAt: Date): Reminder {
  return { id, leadId, leadName: 'ליד', leadStatus: 'new', title: null, dueAt };
}

/** Fully typed rather than cast: a cast would hide the next model change from this spec. */
function lead(id: string, reminderDueAt: Date | null = null): Lead {
  return {
    id,
    name: `ליד ${id}`,
    company: null,
    email: null,
    phone: null,
    source: 'other',
    status: 'new',
    estimatedValue: 0,
    lostReason: null,
    isDemo: false,
    assignedTo: null,
    createdAt: at(2026, 8, 1),
    lastTouchAt: null,
    reminderDueAt,
    reminderTitle: null,
    checklistAnswered: 0,
    answers: {},
    activities: [],
    clearedToday: null,
  };
}

function openItem(id: string, age: number, reminderDueAt: Date | null = null): OpenItem {
  return { lead: lead(id, reminderDueAt), reason: 'drifting', age };
}

describe('bandOf', () => {
  it('bands by calendar day, not by elapsed hours', () => {
    // 23:50 on the 3rd, due 09:00 on the 3rd: hours have passed, the day has not.
    expect(bandOf(at(2026, 8, 3), at(2026, 8, 3, 23, 50))).toBe('today');
  });

  it('flips to overdue the moment the day turns', () => {
    // Ten minutes later, same reminder. This is the boundary the whole helper exists for.
    expect(bandOf(at(2026, 8, 3), at(2026, 8, 4, 0, 10))).toBe('overdue');
  });

  it('treats a due date later today as today, not upcoming', () => {
    // 08:00 now, due 23:00 tonight. Still today — the badge must count it.
    expect(bandOf(at(2026, 8, 3, 23, 0), at(2026, 8, 3, 8, 0))).toBe('today');
  });

  it('bands tomorrow as upcoming even a minute before midnight', () => {
    expect(bandOf(at(2026, 8, 4), at(2026, 8, 3, 23, 59))).toBe('upcoming');
  });

  it('bands a week ago as overdue', () => {
    expect(bandOf(at(2026, 7, 27), at(2026, 8, 3))).toBe('overdue');
  });
});

describe('deriveSuggestions', () => {
  it('excludes leads that already have an open reminder row', () => {
    const rows = [reminder('r1', 'a', at(2026, 8, 5))];
    const items = [openItem('a', 9), openItem('b', 4)];

    expect(deriveSuggestions(items, rows).map((s) => s.lead.id)).toEqual(['b']);
  });

  it('excludes leads whose own reminderDueAt is set, even with no row loaded', () => {
    // The pipeline read carries reminder_due_at; the reminders read may not have run yet.
    // Suggesting a lead the user already scheduled is the one thing this band must not do.
    const items = [openItem('a', 9, at(2026, 8, 5)), openItem('b', 4)];

    expect(deriveSuggestions(items, []).map((s) => s.lead.id)).toEqual(['b']);
  });

  it('sorts oldest drift first', () => {
    const items = [openItem('a', 3), openItem('b', 11), openItem('c', 7)];

    expect(deriveSuggestions(items, []).map((s) => s.lead.id)).toEqual(['b', 'c', 'a']);
  });

  it('returns nothing when every open item is already scheduled', () => {
    const rows = [reminder('r1', 'a', at(2026, 8, 5)), reminder('r2', 'b', at(2026, 8, 6))];

    expect(deriveSuggestions([openItem('a', 9), openItem('b', 4)], rows)).toEqual([]);
  });
});

describe('RemindersStore', () => {
  let store: RemindersStore;
  let notify: { online: () => boolean; failed: jasmine.Spy; blockedOffline: jasmine.Spy };
  let openItems: ReturnType<typeof signal<OpenItem[]>>;

  /**
   * Seeds the store's state directly. `_rows` and `_now` are private because nothing in the
   * app may set them — only a read may — but the banding and guard rules are worth asserting
   * without a Supabase round trip, so the spec reaches them by bracket access.
   */
  function seed(rows: Reminder[], now: Date): void {
    store['_rows'].set(rows);
    store['_now'].set(now);
  }

  beforeEach(() => {
    notify = {
      online: () => true,
      failed: jasmine.createSpy('failed'),
      blockedOffline: jasmine.createSpy('blockedOffline'),
    };
    openItems = signal<OpenItem[]>([]);

    TestBed.configureTestingModule({
      providers: [
        RemindersStore,
        { provide: SupabaseService, useValue: {} },
        { provide: NotifyService, useValue: notify },
        { provide: LeadsStore, useValue: { openItems, leads: signal([]), tenantId: signal('t') } },
      ],
    });
    store = TestBed.inject(RemindersStore);
  });

  it('counts only overdue and today in the badge', () => {
    seed(
      [
        reminder('r1', 'a', at(2026, 8, 1)), // overdue
        reminder('r2', 'b', at(2026, 8, 3)), // today
        reminder('r3', 'c', at(2026, 8, 4)), // upcoming — not the badge's business
        reminder('r4', 'd', at(2026, 8, 30)),
      ],
      at(2026, 8, 3, 10, 0),
    );

    expect(store.openCount()).toBe(2);
    expect(store.upcoming().length).toBe(2);
  });

  it('leaves the badge at zero when suggestions exist but nothing is scheduled', () => {
    // Five drifting leads, no scheduled work: no badge. The bell is the user's own calendar.
    openItems.set([openItem('a', 12), openItem('b', 9)]);
    seed([], at(2026, 8, 3));

    expect(store.suggestions().length).toBe(2);
    expect(store.openCount()).toBe(0);
  });

  it('sorts overdue most-overdue-first and upcoming soonest-first', () => {
    seed(
      [
        reminder('r1', 'a', at(2026, 8, 1)),
        reminder('r2', 'b', at(2026, 7, 20)),
        reminder('r3', 'c', at(2026, 8, 10)),
        reminder('r4', 'd', at(2026, 8, 4)),
      ],
      at(2026, 8, 3),
    );

    expect(store.overdue().map((r) => r.id)).toEqual(['r2', 'r1']);
    expect(store.upcoming().map((r) => r.id)).toEqual(['r4', 'r3']);
  });

  it('refuses a past date on reschedule and says so', async () => {
    // `min` on the native input is a hint, not a validator — this is the actual guard.
    seed([reminder('r1', 'a', at(2026, 8, 3))], at(2026, 8, 3, 10, 0));

    await expectAsync(store.reschedule('r1', at(2026, 8, 2))).toBeResolvedTo(false);
    expect(notify.failed).toHaveBeenCalled();
  });

  it('accepts today on reschedule — today is not the past', () => {
    seed([reminder('r1', 'a', at(2026, 8, 5))], at(2026, 8, 3, 10, 0));

    expect(store['isPast'](at(2026, 8, 3, 8, 0))).toBeFalse();
  });

  it('is empty only when there are neither rows nor suggestions', () => {
    seed([], at(2026, 8, 3));
    expect(store.isEmpty()).toBeTrue();

    openItems.set([openItem('a', 12)]);
    expect(store.isEmpty()).toBeFalse();
  });
});
