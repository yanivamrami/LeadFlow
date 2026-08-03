import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { LucidePhone, LucideX } from '@lucide/angular';

import { COPY, OPEN_ACTION, OPEN_REASON, formatAge, formatValue } from '../../core/copy';
import { Lead, OpenItem } from '../../core/lead.model';
import { HelpService } from '../../core/help.service';
import { LeadsStore } from '../../core/leads.store';
import { DuePicker } from '../../shared/due-picker';

/**
 * The day sheet — the surface's thesis. What is owed today is posted at display scale on
 * the one fluorescent field in the product; clearing an item strikes it through in red and
 * the sheet gets shorter. An empty sheet is the finish line, so it states that rather than
 * disappearing.
 */
@Component({
  selector: 'lf-day-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucidePhone, LucideX, DuePicker],
  templateUrl: './day-sheet.html',
  styleUrl: './day-sheet.scss',
})
export class DaySheet {
  private readonly store = inject(LeadsStore);
  private readonly help = inject(HelpService);
  private readonly router = inject(Router);

  protected readonly copy = COPY;
  protected readonly reasonLabel = OPEN_REASON;
  protected readonly actionLabel = OPEN_ACTION;
  protected readonly formatValue = formatValue;
  protected readonly formatAge = formatAge;

  protected readonly items = this.store.visibleOpenItems;
  protected readonly allItems = this.store.openItems;
  protected readonly hasHidden = this.store.hasHiddenOpenItems;
  protected readonly expanded = this.store.sheetExpanded;
  protected readonly cleared = this.store.clearedToday;
  protected readonly explainerDismissed = this.store.explainerDismissed;
  protected readonly loading = this.store.loading;
  protected readonly loaded = this.store.loaded;

  /**
   * Which item is mid-write. The sheet's actions each take a round trip, and without
   * this the tap looks ignored right up until the row vanishes — the worst possible
   * feedback on the one surface that is supposed to say what is happening.
   */
  protected readonly busyId = signal<string | null>(null);
  /** Which item's day picker is open. One at a time, same rule as the reminders list. */
  protected readonly openPicker = signal<string | null>(null);

  protected busy(lead: Lead): boolean {
    return this.busyId() === lead.id;
  }

  /**
   * The one tap stays only where the verb names a concrete act (`חייג`): those reasons
   * log a typed call with no invented body — the timestamp and the type are the record.
   * The other two reasons say `רשום פעילות`, which names nothing that happened, so they
   * open the composer instead of writing anything on the user's behalf.
   */
  protected async act(item: OpenItem): Promise<void> {
    if (item.reason === 'proposal_silent' || item.reason === 'drifting') {
      if (this.busyId()) return;
      this.busyId.set(item.lead.id);
      try {
        await this.store.logActivity(item.lead.id, 'call');
      } finally {
        this.busyId.set(null);
      }
    } else {
      void this.router.navigate(['/lead', item.lead.id], { queryParams: { at: 'note' } });
    }
  }

  protected togglePicker(leadId: string): void {
    this.openPicker.update((open) => (open === leadId ? null : leadId));
  }

  protected async pickSnooze(lead: Lead, due: Date): Promise<void> {
    if (this.busyId()) return;
    this.busyId.set(lead.id);
    try {
      const ok = await this.store.snooze(lead.id, due);
      if (ok) this.openPicker.set(null);
    } finally {
      this.busyId.set(null);
    }
  }

  protected toggle(): void {
    this.store.toggleSheet();
  }

  protected dismissExplainer(): void {
    this.store.dismissExplainer();
  }

  protected openHelp(): void {
    this.help.show();
  }

  protected focusDrifting(): void {
    this.store.clearFilters();
    this.store.setSearch('');
  }
}
