import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LucidePhone, LucideX } from '@lucide/angular';

import { COPY, OPEN_ACTION, OPEN_REASON, formatAge, formatValue } from '../../core/copy';
import { Lead, OpenItem } from '../../core/lead.model';
import { HelpService } from '../../core/help.service';
import { LeadsStore } from '../../core/leads.store';

/**
 * The day sheet — the surface's thesis. What is owed today is posted at display scale on
 * the one fluorescent field in the product; clearing an item strikes it through in red and
 * the sheet gets shorter. An empty sheet is the finish line, so it states that rather than
 * disappearing.
 */
@Component({
  selector: 'lf-day-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucidePhone, LucideX],
  templateUrl: './day-sheet.html',
  styleUrl: './day-sheet.scss',
})
export class DaySheet {
  private readonly store = inject(LeadsStore);
  private readonly help = inject(HelpService);

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

  protected busy(lead: Lead): boolean {
    return this.busyId() === lead.id;
  }

  protected async act(item: OpenItem): Promise<void> {
    if (this.busyId()) return;
    this.busyId.set(item.lead.id);
    try {
      await this.store.logActivity(item.lead.id, this.actionLabel[item.reason]);
    } finally {
      this.busyId.set(null);
    }
  }

  protected async snooze(lead: Lead): Promise<void> {
    if (this.busyId()) return;
    this.busyId.set(lead.id);
    try {
      await this.store.snooze(lead.id);
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
