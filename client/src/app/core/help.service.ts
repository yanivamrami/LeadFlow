import { Injectable, signal } from '@angular/core';

/**
 * Whether the legend is open. A service rather than a route: the legend explains the
 * screen behind it, so it must be reachable from anywhere without unmounting what it
 * is explaining.
 */
@Injectable({ providedIn: 'root' })
export class HelpService {
  private readonly _open = signal(false);
  readonly open = this._open.asReadonly();

  show(): void {
    this._open.set(true);
  }

  hide(): void {
    this._open.set(false);
  }

  toggle(): void {
    this._open.update((v) => !v);
  }
}
