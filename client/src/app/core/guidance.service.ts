import { Injectable, computed, signal } from '@angular/core';

/**
 * How much teaching shows on screen.
 *
 *   full   every field's help line and every stage's meaning are visible
 *   quiet  the same lines, one tap away
 *
 * **`full` is the default, and that is the whole point.** The PRD's audience are beginners at
 * lead management; a person who does not know what "qualified" means will not go looking for a
 * setting that would tell them. So a fresh visitor is verbose without asking, and quiet is
 * something you opt into once the labels start reading as noise.
 *
 * Two named levels rather than a boolean: it matches `ThemeService`'s shape, it is
 * self-describing in storage, and a third level later needs no migration.
 *
 * Stored in `localStorage` rather than on the profile row because it is a property of *this
 * screen*, not of the account — the same person may want it verbose on a phone they use
 * between jobs and quiet on the desk. It also has to be readable before any network call.
 */

export type GuidanceLevel = 'full' | 'quiet';

export const GUIDANCE_KEY = 'lf-guidance';

function isLevel(value: unknown): value is GuidanceLevel {
  return value === 'full' || value === 'quiet';
}

@Injectable({ providedIn: 'root' })
export class GuidanceService {
  private readonly _level = signal<GuidanceLevel>(this.read());

  readonly level = this._level.asReadonly();

  /** What the templates ask. Named for what it means, not for the stored value. */
  readonly verbose = computed(() => this._level() === 'full');

  set(level: GuidanceLevel): void {
    this._level.set(level);

    try {
      localStorage.setItem(GUIDANCE_KEY, level);
    } catch {
      // Private mode or a blocked storage partition. The choice still holds for this
      // session — losing it on reload beats failing the click.
    }
  }

  /**
   * Anything unreadable, absent or unrecognised resolves to `full`. A corrupted value must
   * fail towards teaching, never towards silence: the cost of an unwanted help line is a
   * glance, and the cost of a missing one is the user not knowing what a stage means.
   */
  private read(): GuidanceLevel {
    if (typeof localStorage === 'undefined') return 'full';
    try {
      const stored = localStorage.getItem(GUIDANCE_KEY);
      return isLevel(stored) ? stored : 'full';
    } catch {
      return 'full';
    }
  }
}
