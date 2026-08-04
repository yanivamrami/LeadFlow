import { AgePipe, DuePipe, ValuePipe, WhenPipe } from './format.pipes';

/**
 * The formatters themselves are covered in copy.spec.ts. What is worth asserting here is that
 * each pipe forwards to the right one with the right argument order — a pipe that silently
 * swaps `date` and `now`, or formats a due date with the past-facing formatter, produces
 * plausible Hebrew that reads exactly backwards.
 */
const NOW = new Date(2026, 7, 3, 10, 0);

describe('format pipes', () => {
  it('lfValue formats currency', () => {
    expect(new ValuePipe().transform(4500)).toContain('4,500');
  });

  it('lfWhen reads in the past tense', () => {
    expect(new WhenPipe().transform(new Date(2026, 7, 2), NOW)).toBe('אתמול');
  });

  it('lfDue reads in the future tense — not the past one', () => {
    // The mistake this catches: forwarding a due date to formatWhen, which would say אתמול
    // about something that has not happened yet.
    expect(new DuePipe().transform(new Date(2026, 7, 4), NOW)).toBe('מחר');
  });

  it('lfDue states lateness as a fact', () => {
    expect(new DuePipe().transform(new Date(2026, 7, 2), NOW)).toBe('באיחור יום');
  });

  it('lfAge is the compact form', () => {
    expect(new AgePipe().transform(2)).toBe('יומיים');
  });

  it('argument order is date-then-now, not the reverse', () => {
    // Swapping them yields a confident wrong answer rather than an error, so it is asserted.
    expect(new WhenPipe().transform(NOW, new Date(2026, 7, 10))).toBe('לפני 7 ימים');
  });
});
