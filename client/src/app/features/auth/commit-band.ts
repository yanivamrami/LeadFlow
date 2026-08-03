import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { COPY } from '../../core/copy';

/**
 * The commit. Deliberately the same organ as the dashboard's `ליד חדש` band — full
 * width, 60px, a 4px ink rule above it, red owning the whole region — so the very first
 * control anyone in this product touches teaches the grammar of every primary action
 * that follows.
 *
 * It bleeds past its parent's padding using `--lf-bleed`, a custom property the page
 * sets; custom properties cross content projection, unlike the styles themselves.
 */
@Component({
  selector: 'lf-commit-band',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="submit"
      [disabled]="busy() || disabled()"
      [attr.aria-busy]="busy() ? 'true' : null"
    >
      {{ busy() ? copy.auth.working : label() }}
    </button>
  `,
  styles: `
    :host {
      display: block;
      /* pushed to the bottom of the column on a phone; a plain gap on a wide screen */
      margin-block-start: auto;
      margin-inline: var(--lf-bleed, 0);
      padding-block-start: var(--lf-space-6);
    }

    button {
      inline-size: 100%;
      min-block-size: 60px;
      padding-inline: var(--lf-space-4);
      border: 0;
      border-block-start: var(--lf-rule-w) solid var(--lf-ink);
      background: var(--lf-red);
      color: var(--lf-on-red);
      font: inherit;
      font-weight: 600;
      font-size: 19px;
      cursor: pointer;
      transition: background var(--lf-dur-state) linear;
    }
    button:hover:not(:disabled) {
      background: color-mix(in srgb, var(--lf-red) 82%, var(--lf-ink));
    }
    button:disabled {
      background: color-mix(in srgb, var(--lf-red) 55%, var(--lf-ground));
      color: color-mix(in srgb, var(--lf-on-red) 80%, transparent);
      cursor: not-allowed;
    }
    button[aria-busy='true'] { cursor: progress; }
  `,
})
export class CommitBand {
  protected readonly copy = COPY;

  readonly label = input.required<string>();
  readonly busy = input(false);
  readonly disabled = input(false);
}
