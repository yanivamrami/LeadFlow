import { StampPipe } from './stamp.pipe';

/**
 * Same reasoning as format.pipes.spec.ts: assert the boundaries (today, yesterday, older)
 * land on the right branch, since a pure pipe silently reusing a stale `now` would be the
 * failure mode that is hardest to notice on screen.
 */
const NOW = new Date(2026, 7, 3, 14, 30);

describe('StampPipe', () => {
  it('reads today as a bare time', () => {
    const at = new Date(2026, 7, 3, 9, 5);
    expect(new StampPipe().transform(at, NOW)).toBe('היום 09:05');
  });

  it('reads yesterday with its time', () => {
    const at = new Date(2026, 7, 2, 18, 0);
    expect(new StampPipe().transform(at, NOW)).toBe('אתמול 18:00');
  });

  it('falls back to an absolute date beyond yesterday', () => {
    const at = new Date(2026, 6, 20, 8, 0);
    expect(new StampPipe().transform(at, NOW)).toBe('20 ביולי');
  });
});
