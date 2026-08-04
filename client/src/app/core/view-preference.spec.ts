import {
  DEFAULT_VIEW,
  VIEW_KEY,
  isDashboardView,
  readViewPreference,
  writeViewPreference,
} from './view-preference';

/**
 * The rules worth pinning: **a chosen view survives a reload**, and **anything unreadable
 * resolves to the list.** The board cannot render honestly under 768px, so a corrupted value
 * must never be able to open it — the list is the view that is wrong for nobody.
 */
describe('view preference', () => {
  afterEach(() => {
    localStorage.removeItem(VIEW_KEY);
  });

  it('opens on the list for someone who has never chosen', () => {
    localStorage.removeItem(VIEW_KEY);
    expect(readViewPreference()).toBe('list');
    expect(DEFAULT_VIEW).toBe('list');
  });

  it('reads back a chosen board the way a fresh page load would', () => {
    writeViewPreference('board');
    expect(readViewPreference()).toBe('board');
  });

  it('reads back a chosen list, so switching off the board also sticks', () => {
    writeViewPreference('board');
    writeViewPreference('list');
    expect(readViewPreference()).toBe('list');
  });

  it('treats a corrupted value as the list rather than the board', () => {
    localStorage.setItem(VIEW_KEY, 'kanban');
    expect(readViewPreference()).toBe('list');
  });

  it('survives storage that refuses to be written', () => {
    const setItem = spyOn(localStorage, 'setItem').and.throwError('blocked');
    expect(() => writeViewPreference('board')).not.toThrow();
    expect(setItem).toHaveBeenCalled();
  });

  it('survives storage that refuses to be read', () => {
    spyOn(localStorage, 'getItem').and.throwError('blocked');
    expect(readViewPreference()).toBe('list');
  });

  it('accepts only the two views that exist', () => {
    expect(isDashboardView('list')).toBe(true);
    expect(isDashboardView('board')).toBe(true);
    expect(isDashboardView('')).toBe(false);
    expect(isDashboardView(null)).toBe(false);
    expect(isDashboardView('Board')).toBe(false);
  });
});
