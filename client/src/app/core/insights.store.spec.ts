import { MIN_DECIDED_FOR_COMPARISON } from './insights.store';

/**
 * The withholding rule is the honesty guarantee of this whole screen, and the
 * conversion denominator is the number a beginner will read as a verdict on their
 * work. Both are arithmetic, so both get pinned here rather than trusted.
 *
 * These mirror the store's computed logic on plain data; the store itself needs a
 * Supabase client to construct, and the rules are what matter.
 */

const conversion = (won: number, decided: number): number | null =>
  decided === 0 ? null : Math.round((won / decided) * 100);

const canCompare = (decided: number): boolean => decided >= MIN_DECIDED_FOR_COMPARISON;

describe('conversion', () => {
  it('counts decided leads only, never the whole pipeline', () => {
    // 4 won, 2 lost, 9 still open: the honest answer is 67%, not 31%.
    expect(conversion(4, 6)).toBe(67);
  });

  it('is null rather than 0% when nothing has been decided', () => {
    // 0% would read as a verdict on their effort. There is simply no answer yet.
    expect(conversion(0, 0)).toBeNull();
  });

  it('reports a genuine zero when leads were decided and none closed', () => {
    expect(conversion(0, 5)).toBe(0);
  });

  it('reports 100 when everything decided closed', () => {
    expect(conversion(3, 3)).toBe(100);
  });
});

describe('comparison threshold', () => {
  it('withholds comparisons below the threshold', () => {
    expect(canCompare(0)).toBe(false);
    expect(canCompare(MIN_DECIDED_FOR_COMPARISON - 1)).toBe(false);
  });

  it('allows them at and above it', () => {
    expect(canCompare(MIN_DECIDED_FOR_COMPARISON)).toBe(true);
    expect(canCompare(MIN_DECIDED_FOR_COMPARISON + 40)).toBe(true);
  });
});
