import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { LucideCheck, LucideCircleAlert, LucideInfo, LucideX } from '@lucide/angular';

import { COPY } from '../core/copy';
import { NotifyService } from '../core/notify.service';
import { Toast } from '../core/notify.model';

/**
 * The pasted stack. Toasts and the checklist nudge are the same object in this world —
 * an ink block with an inline-start rule — so they share one region and queue instead
 * of colliding. The rule colour encodes kind and every kind also carries a mark:
 * colour never signals alone here.
 */
@Component({
  selector: 'lf-toast-stack',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideCheck, LucideCircleAlert, LucideInfo, LucideX],
  template: `
    <div class="stack" [attr.aria-label]="copy.a11y.toastRegion">
      @for (toast of toasts(); track toast.id) {
        <div
          class="toast"
          [class]="'toast--' + toast.kind"
          [attr.role]="toast.kind === 'error' ? 'alert' : 'status'"
          [attr.aria-live]="toast.kind === 'error' ? 'assertive' : 'polite'"
          (mouseenter)="hold(toast)"
          (mouseleave)="resume(toast)"
          (focusin)="hold(toast)"
          (focusout)="resume(toast)"
        >
          <span class="toast__mark" aria-hidden="true">
            @switch (toast.kind) {
              @case ('success') { <svg lucideCheck></svg> }
              @case ('error') { <svg lucideCircleAlert></svg> }
              @default { <svg lucideInfo></svg> }
            }
          </span>

          <p class="toast__text">{{ toast.message }}</p>

          @if (!toast.sticky) {
            <button
              type="button"
              class="toast__x lf-hit"
              [attr.aria-label]="copy.notify.close"
              (click)="dismiss(toast)"
            >
              <svg lucideX aria-hidden="true"></svg>
            </button>
          }

          @if (toast.action || toast.sticky) {
            <div class="toast__acts">
              @if (toast.action) {
                <button type="button" class="tb tb--solid" (click)="run(toast)">
                  {{ toast.action.label }}
                </button>
              }
              @if (toast.sticky) {
                <button type="button" class="tb" (click)="dismiss(toast)">
                  {{ toast.dismissLabel ?? copy.notify.dismiss }}
                </button>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: contents; }

    .stack {
      position: fixed;
      z-index: 80;
      /* above the mobile action band + tabs */
      inset-block-end: calc(58px + 60px + var(--lf-space-3));
      inset-inline: var(--lf-space-3);
      display: flex;
      flex-direction: column-reverse;
      gap: var(--lf-space-2);
      pointer-events: none;
    }

    .toast {
      pointer-events: auto;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: start;
      gap: var(--lf-space-2) var(--lf-space-3);
      padding: 12px var(--lf-space-4);
      background: var(--lf-ink);
      color: var(--lf-on-ink);
      border-inline-start: 4px solid var(--lf-day);
      rotate: var(--lf-paste-tilt);
      animation: paste var(--lf-dur-settle) var(--lf-ease) backwards;
    }
    /* the toast ground is ink in both themes, so red here is the on-ink variant */
    .toast--error { border-inline-start-color: var(--lf-red-on-ink); }
    .toast--success { border-inline-start-color: var(--lf-day); }

    .toast__mark { display: grid; place-items: center; padding-block-start: 2px; }
    .toast__mark svg {
      inline-size: 18px;
      block-size: 18px;
      stroke: currentColor;
      stroke-width: 2.4;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .toast--error .toast__mark { color: var(--lf-red-on-ink); }
    .toast--success .toast__mark { color: var(--lf-day); }

    .toast__text {
      margin: 0;
      font-size: 14px;
      line-height: 1.45;
    }

    .toast__x {
      display: grid;
      place-items: center;
      margin: -10px -8px 0 0;
      background: transparent;
      border: 0;
      color: color-mix(in srgb, var(--lf-on-ink) 70%, transparent);
      cursor: pointer;
    }
    .toast__x:hover { color: var(--lf-on-ink); }
    .toast__x svg {
      inline-size: 16px;
      block-size: 16px;
      stroke: currentColor;
      stroke-width: 2.4;
      fill: none;
      stroke-linecap: round;
    }

    .toast__acts {
      grid-column: 2 / -1;
      display: flex;
      gap: var(--lf-space-2);
      margin-block-start: 4px;
    }

    .tb {
      min-block-size: 38px;
      padding-inline: var(--lf-space-3);
      border: 2px solid var(--lf-on-ink);
      background: transparent;
      color: var(--lf-on-ink);
      font: inherit;
      font-size: 14px;
      cursor: pointer;
    }
    .tb--solid {
      background: var(--lf-day);
      border-color: var(--lf-day);
      color: var(--lf-on-day);
      font-weight: 500;
    }

    @keyframes paste {
      from { opacity: 0; translate: 0 10px; rotate: 0deg; }
      to { opacity: 1; translate: 0 0; rotate: var(--lf-paste-tilt); }
    }

    @media (min-width: 900px) {
      .stack {
        inset-block-end: var(--lf-space-6);
        inset-inline-start: var(--lf-space-6);
        inset-inline-end: auto;
        inline-size: 400px;
      }
    }

    @media (min-width: 1200px) {
      .stack { inset-inline-start: var(--lf-space-8); }
    }
  `,
})
export class ToastStack {
  private readonly notify = inject(NotifyService);

  protected readonly copy = COPY;
  protected readonly toasts = this.notify.toasts;

  protected dismiss(toast: Toast): void {
    this.notify.dismissToast(toast.id);
  }

  protected run(toast: Toast): void {
    toast.action?.run();
    this.notify.dismissToast(toast.id);
  }

  protected hold(toast: Toast): void {
    this.notify.holdToast(toast.id);
  }

  protected resume(toast: Toast): void {
    this.notify.resumeToast(toast.id);
  }
}
