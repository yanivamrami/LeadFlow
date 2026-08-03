import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';

import { App } from './app';
import { routes } from './app.routes';
import { SupabaseService } from './core/supabase.service';

/**
 * The real SupabaseService refuses to construct without a configured URL and key, and
 * tests run against environment.ts, which is empty on purpose. Stub the seam rather
 * than pointing the suite at a live project.
 */
function stubSupabase(authenticated: boolean) {
  const session = signal(authenticated ? ({ user: { email: 'test@leadflow.dev' } } as never) : null);
  return {
    session,
    ready: signal(true),
    user: () => (authenticated ? { email: 'test@leadflow.dev' } : null),
    isAuthenticated: signal(authenticated),
    signOut: () => Promise.resolve(),
  };
}

describe('App', () => {
  async function setup(authenticated: boolean) {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        { provide: SupabaseService, useValue: stubSupabase(authenticated) },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('should create the app', async () => {
    const compiled = await setup(true);
    expect(compiled).toBeTruthy();
  });

  it('renders the shell for a signed-in session', async () => {
    const compiled = await setup(true);
    expect(compiled.querySelector('.mast__brand')?.textContent).toContain('LeadFlow');
    expect(compiled.querySelector('a.skip')?.getAttribute('href')).toBe('#main');
  });

  it('hides the shell when signed out, so sign-in renders on its own', async () => {
    const compiled = await setup(false);
    expect(compiled.querySelector('.mast')).toBeNull();
    expect(compiled.querySelector('.tabs')).toBeNull();
  });
});
