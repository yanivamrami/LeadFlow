import { Stage, StageKind } from './lead.model';
import { archiveCheck } from './stages.rules';

/** Fully typed rather than cast: a cast would hide the next model change from this spec. */
function stage(id: string, kind: StageKind, position: number, archived = false): Stage {
  return {
    id,
    name: `שלב ${id}`,
    shortName: null,
    position,
    kind,
    swatch: 'slate',
    meaning: null,
    guidance: null,
    driftDays: null,
    expectsReply: false,
    isSystem: false,
    archivedAt: archived ? new Date(2026, 0, 1) : null,
  };
}

describe('archiveCheck', () => {
  it('refuses the won stage regardless of lead count', () => {
    const won = stage('won', 'won', 4);
    const all = [stage('open', 'open', 0), won, stage('lost', 'lost', 5)];

    const verdict = archiveCheck(won, 0, all);
    expect(typeof verdict === 'object' && verdict.refused).toBeTruthy();
  });

  it('refuses the lost stage regardless of lead count', () => {
    const lost = stage('lost', 'lost', 5);
    const all = [stage('open', 'open', 0), stage('won', 'won', 4), lost];

    const verdict = archiveCheck(lost, 0, all);
    expect(typeof verdict === 'object' && verdict.refused).toBeTruthy();
  });

  it('refuses the only remaining open stage', () => {
    const onlyOpen = stage('open', 'open', 0);
    const all = [onlyOpen, stage('won', 'won', 4), stage('lost', 'lost', 5)];

    const verdict = archiveCheck(onlyOpen, 0, all);
    expect(typeof verdict === 'object' && verdict.refused).toBeTruthy();
  });

  it('does not count an already-archived open stage toward "only one left"', () => {
    // Two open stages on paper, but one is already archived — archiving the other would
    // still leave the pipeline with nowhere to put a new lead.
    const liveOpen = stage('open-live', 'open', 1);
    const archivedOpen = stage('open-archived', 'open', 0, true);
    const all = [archivedOpen, liveOpen, stage('won', 'won', 4), stage('lost', 'lost', 5)];

    const verdict = archiveCheck(liveOpen, 0, all);
    expect(typeof verdict === 'object' && verdict.refused).toBeTruthy();
  });

  it('asks for a destination when the stage still holds leads', () => {
    const middle = stage('middle', 'open', 1);
    const all = [stage('first', 'open', 0), middle, stage('won', 'won', 4), stage('lost', 'lost', 5)];

    expect(archiveCheck(middle, 3, all)).toBe('needs-destination');
  });

  it('allows an empty, non-reserved, non-only stage to archive outright', () => {
    const middle = stage('middle', 'open', 1);
    const all = [stage('first', 'open', 0), middle, stage('won', 'won', 4), stage('lost', 'lost', 5)];

    expect(archiveCheck(middle, 0, all)).toBe('ok');
  });
});
