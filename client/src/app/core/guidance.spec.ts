import { OPEN_ACTION, OPEN_REASON, STATUS_GUIDANCE } from './copy';
import { nextStepOf, openReasonOf } from './guidance';
import { Lead, LeadStatus } from './lead.model';

/**
 * These rules had no test coverage at all before they moved out of `LeadsStore`, because
 * they were a private method on a service that needs a Supabase client to construct. That
 * is the real reason for the extraction; being reusable was the bonus.
 */

const NOW = new Date(2026, 7, 3, 10, 0);

function at(daysAgo: number): Date {
  return new Date(NOW.getTime() - daysAgo * 86_400_000);
}

function lead(over: Partial<Lead> = {}): Lead {
  return {
    id: 'l1',
    name: 'דנה כהן',
    company: null,
    email: null,
    phone: null,
    source: 'referral',
    status: 'contacted' as LeadStatus,
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
  } as Lead;
}

describe('openReasonOf', () => {
  it('is silent for a closed lead, even with an overdue reminder', () => {
    expect(openReasonOf(lead({ status: 'won', reminderDueAt: at(9) }), NOW)).toBeNull();
    expect(openReasonOf(lead({ status: 'lost', reminderDueAt: at(9) }), NOW)).toBeNull();
  });

  it('puts a due reminder ahead of every inferred rule', () => {
    // Also silent for a week and a silent proposal — the reminder the user set still wins.
    const l = lead({ status: 'proposal_sent', lastTouchAt: at(30), reminderDueAt: at(1) });
    expect(openReasonOf(l, NOW)).toBe('reminder_due');
  });

  it('does not fire a reminder that is still in the future', () => {
    const future = new Date(NOW.getTime() + 3 * 86_400_000);
    expect(openReasonOf(lead({ reminderDueAt: future, lastTouchAt: at(0) }), NOW)).toBeNull();
  });

  it('flags a proposal that has gone quiet for three days', () => {
    expect(openReasonOf(lead({ status: 'proposal_sent', lastTouchAt: at(3) }), NOW)).toBe(
      'proposal_silent',
    );
    expect(openReasonOf(lead({ status: 'proposal_sent', lastTouchAt: at(2) }), NOW)).toBeNull();
  });

  it('flags a new lead nobody has qualified after a day', () => {
    expect(
      openReasonOf(lead({ status: 'new', checklistAnswered: 0, lastTouchAt: at(1) }), NOW),
    ).toBe('unqualified');
  });

  it('stops calling a new lead unqualified once a single question is answered', () => {
    const l = lead({ status: 'new', checklistAnswered: 1, lastTouchAt: at(1) });
    // One day of silence is under `new`'s three-day drift fuse, so nothing is owed.
    expect(openReasonOf(l, NOW)).toBeNull();
  });

  it('falls back to drift at each stage own threshold', () => {
    expect(openReasonOf(lead({ status: 'contacted', lastTouchAt: at(7) }), NOW)).toBe('drifting');
    expect(openReasonOf(lead({ status: 'contacted', lastTouchAt: at(6) }), NOW)).toBeNull();
    expect(openReasonOf(lead({ status: 'qualified', lastTouchAt: at(7) }), NOW)).toBe('drifting');
  });

  it('counts creation as the last touch when nothing has been logged', () => {
    const l = lead({ status: 'contacted', lastTouchAt: null, createdAt: at(8) });
    expect(openReasonOf(l, NOW)).toBe('drifting');
  });
});

describe('nextStepOf', () => {
  it('has nothing to say about a closed lead', () => {
    expect(nextStepOf(lead({ status: 'won' }), NOW)).toBeNull();
    expect(nextStepOf(lead({ status: 'lost' }), NOW)).toBeNull();
  });

  it('carries the urgent reason and its verb when something is overdue', () => {
    const step = nextStepOf(lead({ status: 'proposal_sent', lastTouchAt: at(5) }), NOW);
    expect(step).toEqual({
      text: OPEN_REASON.proposal_silent,
      action: OPEN_ACTION.proposal_silent,
      urgent: true,
    });
  });

  it('falls back to the stage guidance for a healthy lead — the line that was unreachable', () => {
    const step = nextStepOf(lead({ status: 'contacted', lastTouchAt: at(1) }), NOW);
    expect(step).toEqual({ text: STATUS_GUIDANCE.contacted, action: null, urgent: false });
  });

  it('answers for every open stage, so no stage can silently have no advice', () => {
    for (const status of ['new', 'contacted', 'qualified', 'proposal_sent'] as LeadStatus[]) {
      const step = nextStepOf(lead({ status, checklistAnswered: 5, lastTouchAt: at(0) }), NOW);
      expect(step).not.toBeNull();
      expect(step!.text.length).toBeGreaterThan(0);
    }
  });
});
