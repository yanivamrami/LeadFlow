import { TestBed } from '@angular/core/testing';

import { GUIDANCE_KEY, GuidanceService } from './guidance.service';

/**
 * The one rule worth pinning: **an unreadable or absent preference resolves to `full`.**
 * A teaching feature must fail towards explaining itself. The opposite bias would leave a
 * beginner with no help and no way to discover the switch that would have given them some,
 * which is the exact failure this feature exists to fix.
 */
describe('GuidanceService', () => {
  function fresh(): GuidanceService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [GuidanceService] });
    return TestBed.inject(GuidanceService);
  }

  afterEach(() => {
    localStorage.removeItem(GUIDANCE_KEY);
  });

  it('is verbose for a visitor who has never chosen', () => {
    localStorage.removeItem(GUIDANCE_KEY);
    expect(fresh().verbose()).toBe(true);
  });

  it('treats a corrupted value as verbose rather than as quiet', () => {
    localStorage.setItem(GUIDANCE_KEY, 'loud');
    expect(fresh().verbose()).toBe(true);
  });

  it('keeps an explicit quiet across a reload', () => {
    fresh().set('quiet');
    // A second instance reads storage the way a fresh page load would.
    const reloaded = fresh();
    expect(reloaded.level()).toBe('quiet');
    expect(reloaded.verbose()).toBe(false);
  });

  it('survives storage that refuses to be written', () => {
    const service = fresh();
    const setItem = spyOn(localStorage, 'setItem').and.throwError('blocked');

    expect(() => service.set('quiet')).not.toThrow();
    // The choice still holds for this session — losing it on reload beats failing the click.
    expect(service.verbose()).toBe(false);
    expect(setItem).toHaveBeenCalled();
  });

  it('survives storage that refuses to be read', () => {
    spyOn(localStorage, 'getItem').and.throwError('blocked');
    expect(fresh().verbose()).toBe(true);
  });
});
