import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';

import { App } from './app';
import { routes } from './app.routes';
import { SupabaseService } from './core/supabase.service';
import { THEME_KEY, ThemeService } from './core/theme.service';

/**
 * The real SupabaseService refuses to construct without a configured URL and key, and
 * tests run against environment.ts, which is empty on purpose. Stub the seam rather
 * than pointing the suite at a live project.
 */
function stubSupabase() {
  return {
    session: signal(null),
    ready: signal(true),
    whenReady: Promise.resolve(),
    user: () => null,
    isAuthenticated: signal(false),
    inRecovery: signal(false),
    displayName: signal(''),
    email: signal(''),
    signOut: () => Promise.resolve(),
  };
}

describe('App', () => {
  async function setup() {
    TestBed.resetTestingModule();
    localStorage.removeItem(THEME_KEY);

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        { provide: SupabaseService, useValue: stubSupabase() },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('should create the app', async () => {
    expect(await setup()).toBeTruthy();
  });

  /**
   * The shell used to live here behind an `@if (signedIn())`. It is a routed layout now,
   * which is what makes "signed out means no chrome" structural rather than a condition
   * someone can forget to write. Asserting the root is bare is asserting exactly that.
   */
  it('carries only the outlet and the surfaces that outlive a route', async () => {
    const compiled = await setup();

    expect(compiled.querySelector('.mast')).toBeNull();
    expect(compiled.querySelector('.tabs')).toBeNull();
    expect(compiled.querySelector('.band')).toBeNull();
    expect(compiled.querySelector('lf-toast-stack')).not.toBeNull();
    expect(compiled.querySelector('lf-alert-dialog')).not.toBeNull();
  });

  it('resolves the theme onto the document as it boots', async () => {
    await setup();
    const theme = TestBed.inject(ThemeService);

    expect(theme.choice()).toBe('system');
    expect(document.documentElement.getAttribute('data-theme')).toBe(theme.resolved());
  });
});
