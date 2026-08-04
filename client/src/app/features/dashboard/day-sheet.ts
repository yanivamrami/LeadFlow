import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { LucideCircleQuestionMark, LucidePhone, LucideX } from '@lucide/angular';

import { COPY, OPEN_ACTION, OPEN_REASON } from '../../core/copy';
import { Lead, OpenItem } from '../../core/lead.model';
import { HelpService } from '../../core/help.service';
import { LeadsStore } from '../../core/leads.store';
import { DuePicker } from '../../shared/due-picker';
import { AgePipe, ValuePipe } from '../../shared/format.pipes';
import { DaySheetHelp } from './day-sheet-help';

/** An open item with its busy state already decided — see `rows`. */
export interface DaySheetRow {
  item: OpenItem;
  busy: boolean;
}

/**
 * The day sheet — the surface's thesis. What is owed today is posted at display scale on
 * the one fluorescent field in the product; clearing an item strikes it through in red and
 * the sheet gets shorter. An empty sheet is the finish line, so it states that rather than
 * disappearing.
 */
@Component({
  selector: 'lf-day-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    LucideCircleQuestionMark,
    LucidePhone,
    LucideX,
    DuePicker,
    DaySheetHelp,
    ValuePipe,
    AgePipe,
  ],
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

  /** Local, not in HelpService: that one owns the product-wide legend reached from the
   *  masthead, and this popup answers one question about one screen. */
  protected readonly helpOpen = signal(false);

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

  /**
   * Visible items paired with their busy state. `busy(item.lead)` was a component method
   * called six times per row from the template — once per class/attr binding — so it ran
   * six lookups per row on every change-detection pass. This derives it once per change.
   */
  protected readonly rows = computed<DaySheetRow[]>(() => {
    const busyId = this.busyId();
    return this.store.visibleOpenItems().map((item) => ({
      item,
      busy: busyId === item.lead.id,
    }));
  });

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
