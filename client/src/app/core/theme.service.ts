import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

/**
 * Light / dark / follow-the-device. The scene decides the default, not the category:
 * this app is used outdoors and in vans in Israeli daylight, so `system` is the honest
 * default and light is what most people will actually see.
 *
 * The resolved value is written to `<html data-theme>`, which is the selector both
 * tokens.css and the PrimeNG preset (`darkModeSelector` in app.config.ts) read. The
 * same attribute is set by an inline script in index.html before first paint — without
 * it the poster stock flashes white-on-dark on every load.
 */

export type ThemeChoice = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_KEY = 'lf-theme';

function isChoice(value: unknown): value is ThemeChoice {
  return value === 'light' || value === 'dark' || value === 'system';
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _choice = signal<ThemeChoice>(this.read());
  private readonly _prefersDark = signal(false);

  readonly choice = this._choice.asReadonly();

  /** What is actually on screen right now. */
  readonly resolved = computed<ResolvedTheme>(() => {
    const choice = this._choice();
    if (choice !== 'system') return choice;
    return this._prefersDark() ? 'dark' : 'light';
  });

  constructor() {
    if (typeof window === 'undefined') return;

    const query = window.matchMedia('(prefers-color-scheme: dark)');
    this._prefersDark.set(query.matches);

    const onChange = (event: MediaQueryListEvent) => {
      this._prefersDark.set(event.matches);
      // Only a `system` choice is listening; the apply below is a no-op otherwise.
      this.apply();
    };
    query.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => query.removeEventListener('change', onChange));

    this.apply();
  }

  set(choice: ThemeChoice): void {
    this._choice.set(choice);
    this.apply();

    try {
      localStorage.setItem(THEME_KEY, choice);
    } catch {
      // Private mode or a blocked storage partition. The choice still holds for
      // this session — losing it on reload beats failing the click.
    }
  }

  private apply(): void {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', this.resolved());
  }

  private read(): ThemeChoice {
    if (typeof localStorage === 'undefined') return 'system';
    try {
      const stored = localStorage.getItem(THEME_KEY);
      return isChoice(stored) ? stored : 'system';
    } catch {
      return 'system';
    }
  }
}
