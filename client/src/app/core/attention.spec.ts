import { openReasonFor } from './attention';
import { Lead, Stage, StageKind } from './lead.model';

/** 09:00 local on the given day — matches due-picker's own hour. */
function at(y: number, m: number, d: number, h = 9, min = 0): Date {
  return new Date(y, m - 1, d, h, min);
}

const NOW = at(2026, 8, 10);

/** Fully typed rather than cast: a cast would hide the next model change from this spec. */
function stage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: 'stage-1',
    name: 'שלב',
    shortName: null,
    position: 0,
    kind: 'open',
    swatch: 'slate',
    meaning: null,
    guidance: null,
    driftDays: null,
    expectsReply: false,
    isSystem: false,
    archivedAt: null,
    ...overrides,
  };
}

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 'lead-1',
    name: 'ליד',
    company: null,
    email: null,
    phone: null,
    source: 'other',
    stage: stage(),
    estimatedValue: 0,
    lostReason: null,
    isDemo: false,
    assignedTo: null,
    createdAt: at(2026, 8, 1),
    lastTouchAt: null,
    reminderDueAt: null,
    reminderTitle: null,
    checklistAnswered: 0,
    answers: {},
    activities: [],
    clearedToday: null,
    ...overrides,
  };
}

describe('openReasonFor', () => {
  it('returns null for a stage of kind won, whatever else is true', () => {
    const wonStage = stage({ kind: 'won', driftDays: 1 });
    const l = lead({ stage: wonStage, reminderDueAt: at(2026, 8, 1), createdAt: at(2026, 1, 1) });

    expect(openReasonFor(l, NOW, null)).toBeNull();
  });

  it('returns null for a stage of kind lost, whatever else is true', () => {
    const lostStage = stage({ kind: 'lost', driftDays: 1 });
    const l = lead({ stage: lostStage, reminderDueAt: at(2026, 8, 1), createdAt: at(2026, 1, 1) });

    expect(openReasonFor(l, NOW, null)).toBeNull();
  });

  it('flags a due reminder as reminder_due, ahead of every other signal', () => {
    // Also silent long enough for proposal_silent and old enough for drifting — reminder
    // still wins, exactly as it did when this was `status === 'proposal_sent'` first.
    const proposalLike = stage({ expectsReply: true, driftDays: 3 });
    const l = lead({
      stage: proposalLike,
      reminderDueAt: at(2026, 8, 10),
      createdAt: at(2026, 1, 1),
    });

    expect(openReasonFor(l, NOW, null)).toBe('reminder_due');
  });

  it('treats an overdue reminder as due, not just one due exactly today', () => {
    const l = lead({ reminderDueAt: at(2026, 8, 1) });
    expect(openReasonFor(l, NOW, null)).toBe('reminder_due');
  });

  it('ignores a reminder that is not due yet', () => {
    const l = lead({ reminderDueAt: at(2026, 8, 20), createdAt: at(2026, 8, 9) });
    expect(openReasonFor(l, NOW, null)).toBeNull();
  });

  it('flags proposal_silent on a user-created stage with expectsReply, not a name', () => {
    // The generalisation the whole rewrite is for: a homemade "ממתין לחתימה" stage with
    // expectsReply set behaves exactly like the seeded proposal stage once it has been
    // silent for its own driftDays — no hardcoded stage name involved.
    const homemade = stage({
      id: 'custom-1',
      name: 'ממתין לחתימה',
      expectsReply: true,
      driftDays: 4,
    });
    const l = lead({ stage: homemade, createdAt: at(2026, 8, 1), lastTouchAt: at(2026, 8, 6) });

    expect(openReasonFor(l, NOW, null)).toBe('proposal_silent');
  });

  it('does not flag proposal_silent before the stage own silence threshold passes', () => {
    const homemade = stage({ expectsReply: true, driftDays: 4 });
    const l = lead({ stage: homemade, lastTouchAt: at(2026, 8, 8) }); // 2 days silent

    expect(openReasonFor(l, NOW, null)).toBeNull();
  });

  it('never fires proposal_silent when expectsReply is true but driftDays is null', () => {
    // An explicit "never drifts" on an expects-reply stage — the same null that keeps the
    // generic drifting check from firing on it either.
    const l = lead({
      stage: stage({ expectsReply: true, driftDays: null }),
      createdAt: at(2026, 1, 1),
    });

    expect(openReasonFor(l, NOW, null)).toBeNull();
  });

  it('flags unqualified on the first-open stage with no answers, a day old or more', () => {
    const l = lead({
      stage: stage({ id: 'first-open' }),
      createdAt: at(2026, 8, 9),
      checklistAnswered: 0,
    });

    expect(openReasonFor(l, NOW, 'first-open')).toBe('unqualified');
  });

  it('does not flag unqualified the same day the lead arrived', () => {
    const l = lead({
      stage: stage({ id: 'first-open' }),
      createdAt: NOW,
      checklistAnswered: 0,
    });

    expect(openReasonFor(l, NOW, 'first-open')).toBeNull();
  });

  it('does not flag unqualified once any checklist answer exists', () => {
    const l = lead({
      stage: stage({ id: 'first-open' }),
      createdAt: at(2026, 8, 1),
      checklistAnswered: 1,
    });

    expect(openReasonFor(l, NOW, 'first-open')).toBeNull();
  });

  it('does not flag unqualified on a stage that merely shares a position, not an id match', () => {
    // "the stage leads arrive in" is a position, not a name — but the comparison itself is
    // still by id, so a stage that is not actually firstOpen never qualifies as it.
    const l = lead({ stage: stage({ id: 'second-stage' }), createdAt: at(2026, 8, 1) });

    expect(openReasonFor(l, NOW, 'first-open')).toBeNull();
  });

  it('flags generic drifting once the stage own driftDays has passed', () => {
    const l = lead({ stage: stage({ driftDays: 7 }), lastTouchAt: at(2026, 8, 1) }); // 9 days
    expect(openReasonFor(l, NOW, null)).toBe('drifting');
  });

  it('does not flag drifting before the threshold', () => {
    const l = lead({ stage: stage({ driftDays: 7 }), lastTouchAt: at(2026, 8, 5) }); // 5 days
    expect(openReasonFor(l, NOW, null)).toBeNull();
  });

  it('never drifts when driftDays is null, no matter how old the lead is', () => {
    const l = lead({ stage: stage({ driftDays: null }), createdAt: at(2020, 1, 1) });
    expect(openReasonFor(l, NOW, null)).toBeNull();
  });
});
