/**
 * Which dashboard the register opens as: the list, or the board.
 *
 * Stored in `localStorage` rather than on the profile row, for the same reason
 * `GuidanceService` is — it is a property of *this screen*, not of the account. The board
 * needs 768px to be honest, so the same person wants the list on the phone they use between
 * jobs and the board at the desk; a profile column would make those two devices fight over
 * one value. It also has to be readable before any network call, so the first paint after a
 * refresh is the view the user left rather than a flash of the list.
 *
 * Kept out of `LeadsStore.reset()` deliberately: sign-out empties the pipeline, but a
 * layout preference is not the previous user's data and re-picking the board after every
 * login is the annoyance this exists to remove.
 *
 * Pure functions rather than a service: `LeadsStore` already owns the `view` signal, and
 * this way the storage rules are testable without standing up Supabase.
 */

export type DashboardView = 'list' | 'board';

export const VIEW_KEY = 'lf-view';

/** The list is the default: it is the only view that works at every width. */
export const DEFAULT_VIEW: DashboardView = 'list';

export function isDashboardView(value: unknown): value is DashboardView {
  return value === 'list' || value === 'board';
}

/**
 * Anything unreadable, absent or unrecognised resolves to the list. A corrupted value must
 * fail towards the view that cannot be wrong — the board on a narrow window would be a
 * layout the user cannot use, while the list on a wide one is merely not their favourite.
 */
export function readViewPreference(): DashboardView {
  if (typeof localStorage === 'undefined') return DEFAULT_VIEW;
  try {
    const stored = localStorage.getItem(VIEW_KEY);
    return isDashboardView(stored) ? stored : DEFAULT_VIEW;
  } catch {
    return DEFAULT_VIEW;
  }
}

export function writeViewPreference(view: DashboardView): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    // Private mode or a blocked storage partition. The choice still holds for this
    // session — losing it on reload beats failing the click.
  }
}
