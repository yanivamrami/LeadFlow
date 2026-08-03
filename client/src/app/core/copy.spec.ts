import { formatDue } from './copy';

function at(y: number, m: number, d: number, h = 9, min = 0): Date {
  return new Date(y, m - 1, d, h, min);
}

const NOW = at(2026, 8, 3, 10, 0);

describe('formatDue', () => {
  it('states overdue as a fact, with Hebrew singular and dual', () => {
    // Never "you are late" — the stamp reports, it does not scold.
    expect(formatDue(at(2026, 8, 2), NOW)).toBe('באיחור יום');
    expect(formatDue(at(2026, 8, 1), NOW)).toBe('באיחור יומיים');
    expect(formatDue(at(2026, 7, 29), NOW)).toBe('באיחור 5 ימים');
  });

  it('says today for the current calendar day, whatever the hour', () => {
    expect(formatDue(at(2026, 8, 3, 8, 0), NOW)).toBe('היום');
    expect(formatDue(at(2026, 8, 3, 23, 30), NOW)).toBe('היום');
  });

  it('reads forward, never in the past tense', () => {
    // formatWhen would render these as אתמול / לפני יומיים, which is why formatDue exists.
    expect(formatDue(at(2026, 8, 4), NOW)).toBe('מחר');
    expect(formatDue(at(2026, 8, 5), NOW)).toBe('בעוד יומיים');
    expect(formatDue(at(2026, 8, 8), NOW)).toBe('בעוד 5 ימים');
    expect(formatDue(at(2026, 8, 10), NOW)).toBe('בעוד 7 ימים');
  });

  it('falls back to an absolute date past a week out', () => {
    // Relative stops being informative once "in 12 days" needs counting.
    const far = formatDue(at(2026, 8, 20), NOW);
    expect(far).not.toContain('בעוד');
    expect(far).toContain('20');
  });

  it('bands on the calendar day, not on elapsed hours', () => {
    // 23:50, due 09:00 the same day: still היום. Ten minutes later it is overdue.
    expect(formatDue(at(2026, 8, 3), at(2026, 8, 3, 23, 50))).toBe('היום');
    expect(formatDue(at(2026, 8, 3), at(2026, 8, 4, 0, 10))).toBe('באיחור יום');
  });
});
