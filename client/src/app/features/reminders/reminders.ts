import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { COPY, OPEN_REASON, formatDue } from '../../core/copy';
import { Reminder, RemindersStore, Suggestion } from '../../core/reminders.store';
import { DuePicker } from '../../shared/due-picker';
import { StageTag } from '../../shared/stage-tag';

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
  imports: [RouterLink, StageTag, DuePicker],
  templateUrl: './reminders.html',
  styleUrl: './reminders.scss',
})
export class Reminders {
  private readonly store = inject(RemindersStore);

  protected readonly copy = COPY;
  protected readonly reasonLabel = OPEN_REASON;

  protected readonly overdue = this.store.overdue;
  protected readonly today = this.store.today;
  protected readonly upcoming = this.store.upcoming;
  protected readonly suggestions = this.store.suggestions;
  protected readonly allSuggestions = this.store.allSuggestions;
  protected readonly truncated = this.store.suggestionsTruncated;
  protected readonly loading = this.store.loading;
  protected readonly loaded = this.store.loaded;
  protected readonly failed = this.store.failed;
  protected readonly isEmpty = this.store.isEmpty;
  protected readonly busyId = this.store.busyId;

  /** Which row has its date control open. One at a time. */
  protected readonly openPicker = signal<string | null>(null);

  protected readonly skeletonRows = [0, 1, 2];

  constructor() {
    void this.store.load();
  }

  protected due(reminder: Reminder): string {
    return formatDue(reminder.dueAt, this.store.now());
  }

  protected title(reminder: Reminder): string {
    return this.store.titleFor(reminder);
  }

  protected busy(key: string): boolean {
    return this.busyId() === key;
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
