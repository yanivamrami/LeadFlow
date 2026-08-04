import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { COPY, OPEN_REASON } from '../../core/copy';
import { Reminder, RemindersStore, Suggestion } from '../../core/reminders.store';
import { DuePicker } from '../../shared/due-picker';
import { StageTag } from '../../shared/stage-tag';
import { ReminderRow, ReminderRowComponent } from './reminder-row';

/**
 * Reminders — §4.1. The *explicit* ones: rows a person scheduled, which can be completed
 * and moved. A list whose rows cannot be individually completed or rescheduled is not a
 * reminders list, it is a second day sheet with different sorting, and the two would
 * disagree in front of the user.
 *
 * Derived urgency still appears, but as **suggestions** below a rule: leads the pipeline
 * flags that have no reminder of their own, each offering one tap to turn a vague nudge
 * into a dated commitment the user chose. That is the one place the PRD's "automated"
 * and this product's "advisory, never blocking" can both be honoured.
 */
@Component({
  selector: 'lf-reminders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, StageTag, DuePicker, ReminderRowComponent],
  templateUrl: './reminders.html',
  styleUrl: './reminders.scss',
})
export class Reminders {
  private readonly store = inject(RemindersStore);

  protected readonly copy = COPY;
  protected readonly reasonLabel = OPEN_REASON;

  protected readonly suggestions = this.store.suggestions;
  protected readonly allSuggestions = this.store.allSuggestions;
  protected readonly truncated = this.store.suggestionsTruncated;

  /** "showing N of M" for the suggestions band, resolved once per change. */
  protected readonly suggestionsCappedNote = computed(() =>
    COPY.reminders.suggestionsCapped(this.suggestions().length, this.allSuggestions().length),
  );
  protected readonly loading = this.store.loading;
  protected readonly loaded = this.store.loaded;
  protected readonly failed = this.store.failed;
  protected readonly isEmpty = this.store.isEmpty;
  protected readonly busyId = this.store.busyId;

  /** Which row has its date control open. One at a time. */
  protected readonly openPicker = signal<string | null>(null);

  /** The clock the due stamps are measured against; the pipe takes it as an argument. */
  protected readonly now = this.store.now;

  protected readonly skeletonRows = [0, 1, 2];

  /**
   * The three bands, each mapped to rows that already know their title, their busy state and
   * whether their picker is open. One derivation per change instead of six lookups per row
   * per change-detection pass.
   */
  protected readonly overdue = computed(() => this.toRows(this.store.overdue()));
  protected readonly today = computed(() => this.toRows(this.store.today()));
  protected readonly upcoming = computed(() => this.toRows(this.store.upcoming()));

  /** Suggestion rows key their busy state on the lead, since no reminder row exists yet. */
  protected readonly suggestionRows = computed(() => {
    const busyId = this.busyId();
    const open = this.openPicker();
    return this.store.suggestions().map((suggestion) => ({
      suggestion,
      busy: busyId === suggestion.lead.id,
      pickerOpen: open === suggestion.lead.id,
    }));
  });

  constructor() {
    void this.store.load();
  }

  private toRows(reminders: readonly Reminder[]): ReminderRow[] {
    const busyId = this.busyId();
    const open = this.openPicker();
    return reminders.map((reminder) => ({
      reminder,
      title: this.store.titleFor(reminder),
      busy: busyId === reminder.id,
      pickerOpen: open === reminder.id,
    }));
  }

  protected togglePicker(key: string): void {
    this.openPicker.update((open) => (open === key ? null : key));
  }

  protected async complete(reminder: Reminder): Promise<void> {
    await this.store.complete(reminder.id);
  }

  protected async move(reminder: Reminder, due: Date): Promise<void> {
    const ok = await this.store.reschedule(reminder.id, due);
    if (ok) this.openPicker.set(null);
  }

  /** A suggestion becomes a real reminder, titled from the reason the pipeline gave. */
  protected async schedule(suggestion: Suggestion, due: Date): Promise<void> {
    const ok = await this.store.create(
      suggestion.lead.id,
      OPEN_REASON[suggestion.reason],
      due,
    );
    if (ok) this.openPicker.set(null);
  }

  protected retry(): void {
    void this.store.load();
  }
}
