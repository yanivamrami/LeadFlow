import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { LucideEye, LucideEyeOff } from '@lucide/angular';

import { COPY } from '../core/copy';

let seq = 0;

/**
 * One field on a signed-out screen, and the reason those screens need no stylesheet of
 * their own. Label above the control, always visible — a placeholder that disappears
 * when you type is not a label, and this audience fills these in one-handed with the
 * keyboard covering half the screen.
 *
 * Adjacent fields pull up 2px so their ink borders collapse into a single shared rule:
 * the stack reads as one ruled block, the way a form on paper does, rather than a
 * column of floating boxes.
 */
@Component({
  selector: 'lf-text-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideEye, LucideEyeOff],
  template: `
    <label class="lf-label" [attr.for]="id">{{ label() }}</label>

    <div class="box" [class.box--bad]="!!error()">
      <input
        [id]="id"
        [type]="inputType()"
        [name]="name()"
        [attr.autocomplete]="autocomplete()"
        [attr.inputmode]="inputmode()"
        [attr.enterkeyhint]="enterkeyhint()"
        [attr.aria-invalid]="error() ? 'true' : null"
        [attr.aria-describedby]="describedBy()"
        [attr.dir]="dir()"
        [disabled]="disabled()"
        [ngModel]="value()"
        (ngModelChange)="value.set($event)"
        (blur)="touched.set(true)"
      />

      @if (type() === 'password') {
        <button
          type="button"
          class="reveal"
          [attr.aria-label]="revealed() ? copy.auth.hidePassword : copy.auth.showPassword"
          [attr.aria-pressed]="revealed()"
          [disabled]="disabled()"
          (click)="revealed.set(!revealed())"
        >
          @if (revealed()) {
            <svg lucideEyeOff aria-hidden="true"></svg>
          } @else {
            <svg lucideEye aria-hidden="true"></svg>
          }
        </button>
      }
    </div>

    @if (help(); as text) {
      <p class="help" [id]="id + '-help'">{{ text }}</p>
    }
    @if (error(); as text) {
      <p class="bad" [id]="id + '-bad'">{{ text }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      padding-block: var(--lf-space-3) var(--lf-space-4);
    }
    /* borders collapse between neighbours — one ruled block, not stacked boxes */
    :host(:not(:first-of-type)) { margin-block-start: -2px; }

    label {
      display: block;
      margin-block-end: 6px;
      color: var(--lf-muted);
    }

    .box {
      display: flex;
      align-items: stretch;
      border: 2px solid var(--lf-ink);
      background: var(--lf-surface);
    }
    .box:focus-within {
      outline: 3px solid var(--lf-red);
      outline-offset: 2px;
    }
    .box--bad { border-color: var(--lf-red); }

    input {
      flex: 1 1 auto;
      min-inline-size: 0;
      min-block-size: 48px;
      padding-inline: var(--lf-space-3);
      border: 0;
      background: transparent;
      color: var(--lf-ink);
      font: inherit;
      font-size: 17px; /* iOS zooms the page below 16px on focus */
    }
    input:focus { outline: none; }
    input:disabled { color: var(--lf-muted); cursor: not-allowed; }
    /* the browser's autofill wash flattens the poster stock — keep the paper */
    input:-webkit-autofill {
      -webkit-text-fill-color: var(--lf-ink);
      -webkit-box-shadow: 0 0 0 60px var(--lf-surface) inset;
    }

    .reveal {
      display: grid;
      place-items: center;
      flex: 0 0 auto;
      inline-size: var(--lf-touch);
      border: 0;
      border-inline-start: 2px solid var(--lf-ink);
      background: transparent;
      color: var(--lf-ink);
      cursor: pointer;
      transition: background var(--lf-dur-state) linear, color var(--lf-dur-state) linear;
    }
    .reveal:hover { background: var(--lf-ink); color: var(--lf-on-ink); }
    .reveal svg { inline-size: 19px; block-size: 19px; stroke-width: 2.4; }

    .help,
    .bad {
      margin: 8px 0 0;
      font-size: var(--lf-size-small);
      line-height: 1.4;
    }
    .help { color: var(--lf-muted); }
    .bad { color: var(--lf-red-text); font-weight: 500; }
  `,
})
export class TextField {
  protected readonly copy = COPY;
  protected readonly id = `f${++seq}`;

  readonly label = input.required<string>();
  readonly name = input.required<string>();
  readonly type = input<'text' | 'email' | 'password'>('text');
  readonly autocomplete = input<string | null>(null);
  readonly inputmode = input<string | null>(null);
  readonly enterkeyhint = input<string | null>(null);
  readonly help = input<string | null>(null);
  readonly error = input<string | null>(null);
  readonly disabled = input(false);

  readonly value = model<string>('');

  /** Set on first blur, so validation never scolds someone mid-typing. */
  readonly touched = signal(false);

  protected readonly revealed = signal(false);
  protected readonly inputType = computed(() =>
    this.type() === 'password' && this.revealed() ? 'text' : this.type(),
  );

  /**
   * Email and password are Latin even inside a Hebrew RTL page. Left to inherit, an
   * address types right-to-left and reads back scrambled around its `@`.
   */
  protected readonly dir = computed(() => (this.type() === 'text' ? null : 'ltr'));

  protected readonly describedBy = computed(() => {
    const parts: string[] = [];
    if (this.help()) parts.push(`${this.id}-help`);
    if (this.error()) parts.push(`${this.id}-bad`);
    return parts.length ? parts.join(' ') : null;
  });
}
