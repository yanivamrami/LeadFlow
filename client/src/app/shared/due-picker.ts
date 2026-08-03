import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { COPY } from '../core/copy';

/**
 * Pick a day for a reminder. Inline, never a modal — 3.6 and 3.7 already set the
 * in-place pattern, and opening this must not lose the list behind it.
 *
 * Three chips and a date field, because a fourth chip is a menu. The field is a native
 * `<input type="date">` for the reason 2.8 recorded for the sort control: on a phone the
 * OS picker beats anything custom and is accessible for free. The open picker is the
 * platform's, not this world's — accepted deliberately.
 *
 * No time of day is asked. `due_at` is a timestamptz, but the product reasons in whole
 * days everywhere (`daysBetween`, `DRIFT_DAYS`, `formatAge`), so asking for a time would
 * invent a precision the rest of the app immediately discards. 09:00 local it is.
 */
@Component({
  selector: 'lf-due-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pick" role="group" [attr.aria-label]="copy.reminders.pickDate">
      <div class="pick__chips">
        <button type="button" class="chip" [disabled]="busy()" (click)="choose(1)">
          {{ copy.reminders.pickTomorrow }}
        </button>
        <button type="button" class="chip" [disabled]="busy()" (click)="choose(3)">
          {{ copy.reminders.pick3 }}
        </button>
        <button type="button" class="chip" [disabled]="busy()" (click)="choose(7)">
          {{ copy.reminders.pickWeek }}
        </button>
      </div>

      <div class="pick__row">
        <label class="pick__date">
          <span class="lf-sr">{{ copy.reminders.pickDate }}</span>
          <input
            type="date"
            [min]="minDate()"
            [value]="typed()"
            [disabled]="busy()"
            (input)="typed.set($any($event.target).value)"
          />
        </label>

        <button
          type="button"
          class="chip chip--go"
          [disabled]="busy() || !typed()"
          (click)="confirmTyped()"
        >
          {{ busy() ? copy.reminders.working : copy.reminders.pickSave }}
        </button>
        <button type="button" class="chip chip--bare" [disabled]="busy()" (click)="cancel.emit()">
          {{ copy.reminders.pickCancel }}
        </button>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }

    .pick {
      margin-block-start: var(--lf-space-3);
      padding: var(--lf-space-3);
      border: 2px solid var(--lf-ink);
      background: var(--lf-surface);
    }

    .pick__chips,
    .pick__row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--lf-space-2);
    }
    .pick__row { margin-block-start: var(--lf-space-2); }

    .chip {
      min-block-size: var(--lf-touch);
      padding-inline: var(--lf-space-3);
      border: 2px solid var(--lf-ink);
      background: transparent;
      color: var(--lf-ink);
      font: inherit;
      font-size: 14px;
      cursor: pointer;
      transition: background var(--lf-dur-state) linear, color var(--lf-dur-state) linear;
    }
    .chip:hover:not(:disabled) { background: var(--lf-ink); color: var(--lf-on-ink); }
    .chip:disabled { opacity: 0.6; cursor: default; }

    .chip--go {
      background: var(--lf-red);
      border-color: var(--lf-red);
      color: var(--lf-on-red);
      font-weight: 500;
    }
    .chip--bare { border-color: transparent; color: var(--lf-muted); }
    .chip--bare:hover:not(:disabled) {
      background: transparent;
      color: var(--lf-red-text);
    }

    .pick__date { flex: 1 1 160px; min-inline-size: 0; }
    .pick__date input {
      inline-size: 100%;
      min-block-size: var(--lf-touch);
      padding-inline: var(--lf-space-2);
      border: 2px solid var(--lf-ink);
      border-radius: 0;
      background: var(--lf-ground);
      color: var(--lf-ink);
      font: inherit;
      font-size: 16px; /* iOS zooms below 16 on focus */
    }
    .pick__date input:focus-visible { outline: 3px solid var(--lf-red); outline-offset: 2px; }
  `,
})
export class DuePicker {
  readonly busy = input(false);

  /** Emits the chosen day at 09:00 local. */
  readonly picked = output<Date>();
  readonly cancel = output<void>();

  protected readonly copy = COPY;
  protected readonly typed = signal('');

  protected readonly minDate = computed(() => this.iso(new Date()));

  protected choose(daysAhead: number): void {
    const date = new Date();
    date.setDate(date.getDate() + daysAhead);
    this.picked.emit(this.atMorning(date));
  }

  protected confirmTyped(): void {
    const value = this.typed();
    if (!value) return;
    const [y, m, d] = value.split('-').map(Number);
    if (!y || !m || !d) return;
    this.picked.emit(this.atMorning(new Date(y, m - 1, d)));
  }

  private atMorning(date: Date): Date {
    const at = new Date(date);
    at.setHours(9, 0, 0, 0);
    return at;
  }

  private iso(date: Date): string {
    const y = date.getFullYear();
    const m = `${date.getMonth() + 1}`.padStart(2, '0');
    const d = `${date.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
