import { AppError, costsData } from './supabase.service';

/**
 * The severity rule is the whole notification system in one function: it decides
 * whether the user gets interrupted or merely told. It is pure, so it is cheap to
 * pin down — and getting it wrong either loses data silently or trains people to
 * dismiss modals.
 */
describe('costsData', () => {
  const error = (code: string): AppError => ({ message: 'x', code, cause: null });

  it('never interrupts for a failed read', () => {
    expect(costsData(error('unknown'), false)).toBe(false);
    expect(costsData(error('23505'), false)).toBe(false);
  });

  it('announces when the server explained itself', () => {
    // The user can act on these, and nothing was half-written.
    expect(costsData(error('23505'), true)).toBe(false); // already exists
    expect(costsData(error('42501'), true)).toBe(false); // RLS denial
    expect(costsData(error('PGRST116'), true)).toBe(false); // no rows matched
    expect(costsData(error('invalid_credentials'), true)).toBe(false);
  });

  it('announces when nothing left the browser', () => {
    // Offline is blocked before the write is attempted, so nothing is at risk.
    expect(costsData(error('network'), true)).toBe(false);
  });

  it('does not interrupt on an expired session', () => {
    // The redirect to sign-in is the interruption; a modal on top would be redundant.
    expect(costsData(error('PGRST301'), true)).toBe(false);
  });

  it('interrupts on an unexplained write failure', () => {
    // We do not know whether the row landed, and the user believes it did.
    expect(costsData(error('unknown'), true)).toBe(true);
    expect(costsData(error('57014'), true)).toBe(true); // statement timeout
    expect(costsData(error('08006'), true)).toBe(true); // connection failure mid-write
  });
});
