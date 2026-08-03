import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface StripRow {
  text: string;
  linkLabel: string;
  link: string;
}

/**
 * The route out of this screen — pasted, not printed.
 *
 * The design system's guidance layer says an aside is an ink strip stuck on at -0.4°
 * with yellow for the emphasis, so that is what the alternate route is: a strip pasted
 * under the commit. It is deliberately not a small grey centred link, which is what
 * every sign-in screen in the category does and what nobody sees.
 */
@Component({
  selector: 'lf-paste-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @for (row of rows(); track row.link) {
      <p class="row">
        {{ row.text }}
        <a [routerLink]="row.link">{{ row.linkLabel }}</a>
      </p>
    }
  `,
  styles: `
    /*
     * Fixed tokens, not theme-flipping ones.
     *
     * This is an *ink* strip with yellow for the emphasis — that is the design system's
     * description of the guidance aside, and yellow only reads on dark. With --lf-ink the
     * strip inverted in dark mode to a near-white panel, and the yellow link on it measured
     * about 1.2:1: the one route off the sign-in screen, invisible.
     *
     * So the strip is a fixed object in both themes, like the day sheet and the toast stack.
     * It does not follow the theme because its whole construction depends on being dark.
     */
    :host {
      display: block;
      margin-block: var(--lf-space-6);
      padding: var(--lf-space-3) var(--lf-space-4);
      background: var(--lf-fixed-ink);
      color: var(--lf-fixed-paper);
      rotate: var(--lf-paste-tilt);
    }

    .row {
      margin: 0;
      font-size: var(--lf-size-body);
      line-height: 1.5;
    }
    .row + .row {
      margin-block-start: 10px;
      padding-block-start: 10px;
      border-block-start: 1px solid color-mix(in srgb, var(--lf-fixed-paper) 28%, transparent);
    }

    a {
      color: var(--lf-day);
      font-weight: 500;
      text-decoration-thickness: 2px;
      text-underline-offset: 3px;
    }
    a:hover { text-decoration-thickness: 3px; }

    @media (prefers-reduced-motion: reduce) {
      :host { rotate: 0deg; }
    }
  `,
})
export class PasteStrip {
  readonly rows = input.required<readonly StripRow[]>();
}
