import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';

import { COPY } from '../core/copy';
import { NotifyService } from '../core/notify.service';

/**
 * The interrupt. It fires for one thing only: a write that did not persist while the
 * user believed it had. Everything recoverable is a toast.
 *
 * In the market-sign world a modal is a notice pasted over the wall — so the scrim is
 * ink, not a blur, and the sheet stamps into place with the product's one motion idea
 * rather than shaking or pulsing. The mark is the product's own object (a lead sheet,
 * torn) instead of a stock warning triangle: it says "this didn't save" before the
 * headline is read, and no other product could use it.
 */
@Component({
  selector: 'lf-alert-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [A11yModule],
  template: `
    @if (alert(); as a) {
      <div class="scrim"></div>

      <div
        class="sheet"
        role="alertdialog"
        aria-modal="true"
        [attr.aria-labelledby]="'alert-title-' + a.id"
        [attr.aria-describedby]="'alert-body-' + a.id"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
        (keydown.escape)="dismiss()"
      >
        <div class="mark" aria-hidden="true">
          <svg viewBox="0 0 96 96" role="presentation">
            <!-- upper fragment: the sheet as it should be -->
            <g class="mark__top">
              <path d="M18 8 H62 L78 24 V44 H18 Z" />
              <path d="M62 8 V24 H78" />
              <path d="M30 34 H60" />
            </g>
            <!-- lower fragment, displaced: the part that never landed -->
            <g class="mark__bottom">
              <path d="M18 52 H78 V88 H18 Z" />
              <path d="M30 64 H66" />
              <path d="M30 76 H52" />
            </g>
            <!-- the tear -->
            <path class="mark__tear" d="M14 48 L28 42 L42 52 L56 42 L70 52 L82 45" />
          </svg>
        </div>

        <h2 class="title" [id]="'alert-title-' + a.id">{{ a.title }}</h2>
        <p class="body" [id]="'alert-body-' + a.id">{{ a.body }}</p>

        @if (a.code) {
          <p class="code lf-num">{{ copy.notify.code(a.code) }}</p>
        }

        <div class="acts">
          @if (a.retry) {
            <button type="button" class="b b--red" (click)="retry()">
              {{ copy.notify.retry }}
            </button>
          }
          <button type="button" class="b" (click)="dismiss()">{{ copy.notify.dismiss }}</button>
        </div>
      </div>
    }
  `,
  styles: `
    :host { display: contents; }

    /* the wall goes dark — ink, not glass. This world has no blur. */
    .scrim {
      position: fixed;
      inset: 0;
      z-index: 90;
      background: color-mix(in srgb, var(--lf-ink) 82%, transparent);
      animation: scrim-in var(--lf-dur-overlay) var(--lf-ease) backwards;
    }

    .sheet {
      position: fixed;
      z-index: 91;
      inset-block-start: 50%;
      inset-inline-start: 50%;
      translate: 50% -50%;
      inline-size: min(420px, calc(100vw - 32px));
      max-block-size: calc(100vh - 32px);
      overflow-y: auto;
      background: var(--lf-ground);
      color: var(--lf-ink);
      border: 3px solid var(--lf-ink);
      padding: var(--lf-space-8) var(--lf-space-6) var(--lf-space-6);
      text-align: center;
      animation: stamp var(--lf-dur-settle) var(--lf-ease) backwards;
    }

    .mark {
      display: grid;
      place-items: center;
      margin-block-end: var(--lf-space-4);
    }
    .mark svg {
      inline-size: 96px;
      block-size: 96px;
      fill: none;
      stroke: var(--lf-ink);
      stroke-width: 3;
      stroke-linecap: square;
      stroke-linejoin: miter;
    }
    /* the displaced fragment: drawn where it landed, not where it belongs */
    .mark__bottom { translate: 4px 3px; opacity: 0.55; }
    .mark__tear { stroke: var(--lf-red); stroke-width: 3.5; }

    .title {
      margin: 0;
      font-weight: 600;
      font-size: 26px;
      line-height: 1.1;
    }

    .body {
      margin: var(--lf-space-3) 0 0;
      font-size: var(--lf-size-body);
      line-height: 1.5;
      text-wrap: balance;
    }

    .code {
      margin: var(--lf-space-3) 0 0;
      font-size: 12px;
      font-weight: 500;
      color: var(--lf-muted);
      user-select: all;
    }

    .acts {
      display: flex;
      gap: var(--lf-space-2);
      margin-block-start: var(--lf-space-6);
    }

    .b {
      flex: 1 1 auto;
      min-block-size: var(--lf-touch);
      padding-inline: var(--lf-space-4);
      border: 2px solid var(--lf-ink);
      background: transparent;
      color: var(--lf-ink);
      font: inherit;
      font-weight: 500;
      cursor: pointer;
      transition: background var(--lf-dur-state) linear, color var(--lf-dur-state) linear;
    }
    .b:hover { background: var(--lf-ink); color: var(--lf-on-ink); }
    .b--red {
      background: var(--lf-red);
      border-color: var(--lf-red);
      color: var(--lf-on-red);
      font-weight: 600;
    }
    .b--red:hover { background: var(--lf-ink); border-color: var(--lf-ink); color: var(--lf-on-ink); }

    /* paper settling — the same gesture the register and the nudge use */
    @keyframes stamp {
      from { opacity: 0; scale: 1.06; rotate: 1.5deg; }
      to { opacity: 1; scale: 1; rotate: 0deg; }
    }
    @keyframes scrim-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @media (prefers-reduced-motion: reduce) {
      .sheet { animation: scrim-in 80ms linear backwards; }
    }
  `,
})
export class AlertDialog {
  private readonly notify = inject(NotifyService);

  protected readonly copy = COPY;
  protected readonly alert = this.notify.alert;
  protected readonly hasAlert = computed(() => this.alert() !== null);

  protected dismiss(): void {
    const current = this.alert();
    if (current) this.notify.dismissAlert(current.id);
  }

  protected retry(): void {
    this.alert()?.retry?.();
  }
}
