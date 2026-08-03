import { OPEN_ACTION, OPEN_REASON } from './copy';
import { nextStepOf } from './guidance';
import { Lead, Stage } from './lead.model';

/**
 * The advice layer, which had no coverage at all before it left `LeadsStore` — it was a private
 * method on a service that needs a Supabase client to construct.
 *
 * The *reason* rules are not tested here. They live in `attention.ts` and are covered by
 * `attention.spec.ts`; this file had its own status-keyed copy of them, which the stages
 * refactor made both wrong and redundant. What is left is the part that was genuinely new:
 * which of the two things `nextStepOf` says, and when it says nothing at all.
 */

const NOW = new Date(2026, 7, 3, 10, 0);

function at(daysAgo: number): Date {
  return new Date(NOW.getTime() - daysAgo * 86_400_000);
}

function stage(over: Partial<Stage> = {}): Stage {
  return {
    id: 'stage-contacted',
    name: 'יצרנו קשר',
    shortName: 'קשר',
    position: 1,
    kind: 'open',
    swatch: 'sky',
    meaning: 'דיברתם איתם לפחות פעם אחת.',
    guidance: 'עכשיו כדאי לבדוק אם הם באמת צריכים את מה שאתם מציעים.',
    driftDays: 7,
    expectsReply: false,
    isSystem: true,
    archivedAt: null,
    ...over,
  };
}

function lead(over: Partial<Lead> = {}): Lead {
  return {
    id: 'l1',
    name: 'דנה כהן',
    company: null,
    email: null,
    phone: null,
    source: 'referral',
    stage: stage(),
    estimatedValue: 0,
    lostReason: null,
    isDemo: false,
    assignedTo: null,
    createdAt: at(0),
    lastTouchAt: at(0),
    reminderDueAt: null,
    reminderTitle: null,
    checklistAnswered: 0,
    answers: {},
    activities: [],
    clearedToday: null,
    ...over,
  };
}

const FIRST_OPEN = 'stage-new';

describe('nextStepOf', () => {
  it('has nothing to say about a closed lead, whatever the stage is called', () => {
    // The point of `kind`: these stages are named nothing like won/lost and still close.
    const won = stage({ id: 's-won', name: 'לקוח משלם', kind: 'won', driftDays: null });
    const lost = stage({ id: 's-lost', name: 'לא הסתדר', kind: 'lost', driftDays: null });

    expect(nextStepOf(lead({ stage: won }), NOW, FIRST_OPEN)).toBeNull();
    expect(nextStepOf(lead({ stage: lost }), NOW, FIRST_OPEN)).toBeNull();
  });

  it('carries the urgent reason and its verb when something is overdue', () => {
    // A stage where the ball is in their court, silent past its own threshold.
    const waiting = stage({ id: 's-prop', name: 'נשלחה הצעה', expectsReply: true, driftDays: 3 });
    const step = nextStepOf(lead({ stage: waiting, lastTouchAt: at(5) }), NOW, FIRST_OPEN);

    expect(step).toEqual({
      text: OPEN_REASON.proposal_silent,
      action: OPEN_ACTION.proposal_silent,
      urgent: true,
    });
  });

  it("falls back to the stage's own guidance for a healthy lead", () => {
    const step = nextStepOf(lead({ lastTouchAt: at(1) }), NOW, FIRST_OPEN);

    expect(step).toEqual({
      text: 'עכשיו כדאי לבדוק אם הם באמת צריכים את מה שאתם מציעים.',
      action: null,
      urgent: false,
    });
  });

  it('reads guidance off the row, so a user-created stage advises in the user\'s own words', () => {
    // The whole reason the teaching copy moved into the database: this stage did not exist
    // when the app was written, and it still has something to say.
    const mine = stage({ id: 's-sign', name: 'ממתין לחתימה', guidance: 'תזכירו בעדינות.' });
    const step = nextStepOf(lead({ stage: mine, lastTouchAt: at(1) }), NOW, FIRST_OPEN);

    expect(step?.text).toBe('תזכירו בעדינות.');
    expect(step?.urgent).toBeFalse();
  });

  it('says nothing rather than something generic when a stage has no guidance', () => {
    // Was impossible with a copy map, which always had a line for every enum value. A stage
    // the user never described has no advice to give, and inventing one would be worse.
    const bare = stage({ id: 's-bare', name: 'שלב משלי', guidance: null });

    expect(nextStepOf(lead({ stage: bare, lastTouchAt: at(1) }), NOW, FIRST_OPEN)).toBeNull();
  });

  it('treats blank guidance as absent', () => {
    const blank = stage({ id: 's-blank', guidance: '   ' });

    expect(nextStepOf(lead({ stage: blank, lastTouchAt: at(1) }), NOW, FIRST_OPEN)).toBeNull();
  });

  it('prefers the urgent reason over the stage guidance', () => {
    // Both are available here; overdue wins, because advice about what the stage is for is
    // not what someone needs when they are already late.
    const step = nextStepOf(lead({ reminderDueAt: at(1) }), NOW, FIRST_OPEN);

    expect(step?.urgent).toBeTrue();
    expect(step?.text).toBe(OPEN_REASON.reminder_due);
  });
});
