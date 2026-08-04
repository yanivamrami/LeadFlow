import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { COPY } from '../../core/copy';
import { Reminder } from '../../core/reminders.store';
import { DuePicker } from '../../shared/due-picker';
import { DuePipe } from '../../shared/format.pipes';
import { StageTag } from '../../shared/stage-tag';

/** A reminder with everything its row needs already decided — see `reminders.ts`. */
export interface ReminderRow {
  reminder: Reminder;
  title: string;
  busy: boolean;
  pickerOpen: boolean;
}

/**
 * One reminder row.
 *
 * Extracted because the three bands — overdue, today, upcoming — carried byte-identical
 * markup, forty lines each. Three copies of a row is three places for the busy state, the
 * aria wiring and the picker to drift apart, and the only difference between them was one
 * class on the due stamp.
 *
 * Presentational: every value arrives resolved and every action leaves as an event. That is
 * what makes it testable without a store, and what lets the parent derive `busy` once per
 * change instead of the template asking six times per row per change-detection pass.
 */
@Component({
  selector: 'lf-reminder-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, StageTag, DuePicker, DuePipe],
  template: `
    <article class="row" [class.row--busy]="row().busy" [class.lf-sweep]="row().busy">
      <div class="row__main">
        <h3 class="row__name">
          <a [routerLink]="['/lead', row().reminder.leadId]">{{ row().reminder.leadName }}</a>
        </h3>
        <p class="row__meta">
          <span class="row__note">{{ row().title }}</span>
          <lf-stage-tag [stage]="row().reminder.leadStage" [short]="true" />
        </p>
      </div>

      <!-- overdue is carried by the band heading and this stamp, never by a red row -->
      <span class="row__due lf-num" [class.row__due--late]="late()">
        {{ row().reminder.dueAt | lfDue: now() }}
      </span>

      <div class="row__acts">
        <button type="button" class="b" [disabled]="row().busy" (click)="completed.emit()">
          {{ row().busy ? copy.reminders.working : copy.reminders.complete }}
        </button>
        <button
          type="button"
          class="b b--bare"
          [attr.aria-expanded]="row().pickerOpen"
          [disabled]="row().busy"
          (click)="toggled.emit()"
        >
          {{ copy.reminders.reschedule }}
        </button>
      </div>

      @if (row().pickerOpen) {
        <lf-due-picker
          class="row__picker"
          [busy]="row().busy"
          (picked)="moved.emit($event)"
          (cancel)="toggled.emit()"
        />
      }
    </article>
  `,
  styleUrl: './reminder-row.scss',
})
export class ReminderRowComponent {
  readonly row = input.required<ReminderRow>();
  /** Only visual difference between the bands: the stamp turns red. */
  readonly late = input(false);
  /** The clock the due stamp is measured against, passed down rather than read from a store. */
  readonly now = input.required<Date>();

  readonly completed = output<void>();
  readonly toggled = output<void>();
  readonly moved = output<Date>();

  protected readonly copy = COPY;
}
