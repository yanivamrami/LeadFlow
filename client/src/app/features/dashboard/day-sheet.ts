import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { LucidePhone, LucideX } from '@lucide/angular';

import { COPY, OPEN_ACTION, OPEN_REASON, formatAge, formatValue } from '../../core/copy';
import { Lead, OpenItem } from '../../core/lead.model';
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
  imports: [LucidePhone, LucideX],
  templateUrl: './day-sheet.html',
  styleUrl: './day-sheet.scss',
})
export class DaySheet {
  private readonly store = inject(LeadsStore);

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

  protected act(item: OpenItem): void {
    this.store.logActivity(item.lead.id, this.actionLabel[item.reason]);
  }

  protected snooze(lead: Lead): void {
    this.store.snooze(lead.id);
  }

  protected toggle(): void {
    this.store.toggleSheet();
  }

  protected dismissExplainer(): void {
    this.store.dismissExplainer();
  }

  protected focusDrifting(): void {
    this.store.clearFilters();
    this.store.setSearch('');
  }
}
