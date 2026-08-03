import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * What the server said, in Hebrew, above the commit.
 *
 * It is a bordered block rather than a tinted callout with a coloured edge: this world
 * has no fills that mean "warning" and no rounded panels. Three points of red rule is
 * how the product already draws a thing that stops you.
 *
 * `role="alert"` is on the element that appears, not on a permanent wrapper, so screen
 * readers announce it once, when it happens.
 */
@Component({
  selector: 'lf-form-error',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (message(); as text) {
      <p class="bad" role="alert">{{ text }}</p>
    }
  `,
  styles: `
    :host { display: block; }

    .bad {
      margin: var(--lf-space-4) 0 0;
      padding: var(--lf-space-3) var(--lf-space-4);
      border: 3px solid var(--lf-red);
      color: var(--lf-red-ink);
      font-weight: 500;
      line-height: 1.45;
      animation: settle var(--lf-dur-enter) var(--lf-ease) backwards;
    }

    @keyframes settle {
      from { opacity: 0; translate: 0 6px; }
      to { opacity: 1; translate: 0 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .bad { animation-duration: 80ms; animation-timing-function: linear; }
    }
  `,
})
export class FormError {
  readonly message = input<string | null>(null);
}
