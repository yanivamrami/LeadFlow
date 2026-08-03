import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import {
  COPY,
  SORT_LABEL,
  SOURCE_LABEL,
  STATUS_LABEL,
  formatValue,
  formatWhen,
} from '../../core/copy';
import { Lead, LeadStatus, SORT_KEYS, SortKey } from '../../core/lead.model';
import { LeadsStore } from '../../core/leads.store';
import { LeadMenu } from '../../shared/lead-menu';
import { StageTag } from '../../shared/stage-tag';

/**
 * The register — every lead, ranked by urgency. Attention is a flag stuck to the row's
 * inline-start edge: solid yellow means "needs you", hatched means "drifting". Texture and
 * fill differ, not only hue, so the distinction survives greyscale and colour blindness.
 */
@Component({
  selector: 'lf-register',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, StageTag, LeadMenu],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  private readonly store = inject(LeadsStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly copy = COPY;
  protected readonly sourceLabel = SOURCE_LABEL;
  protected readonly sortLabel = SORT_LABEL;
  protected readonly sortKeys = SORT_KEYS;
  protected readonly formatValue = formatValue;

  protected readonly leads = this.store.visibleLeads;
  protected readonly total = this.store.total;
  protected readonly isFiltered = this.store.isFiltered;
  protected readonly loading = this.store.loading;
  protected readonly loaded = this.store.loaded;
  protected readonly sort = this.store.sort;
  /** Placeholder rows while the first read is in flight. */
  protected readonly skeletonRows = [0, 1, 2, 3, 4, 5];

  /**
   * A filter the user cannot see is one they will not think to remove — this names it,
   * so it only renders once the source actually is filtered.
   */
  protected readonly sourceFilterLabel = computed(() => {
    const source = this.store.sourceFilter();
    return source === 'all' ? null : this.sourceLabel[source];
  });

  protected setSort(value: string): void {
    this.store.setSort(value as SortKey);
  }

  protected attention(lead: Lead): 'now' | 'drift' | 'none' {
    return this.store.attentionOf(lead);
  }

  protected when(lead: Lead): string {
    return formatWhen(lead.lastTouchAt, this.store.now());
  }

  protected silentDays(lead: Lead): number {
    return this.store.ageInDays(lead);
  }

  protected move(lead: Lead, status: LeadStatus): void {
    this.store.moveToStage(lead.id, status, STATUS_LABEL[status]);
  }

  /**
   * The row's activity is a record, not a label — writing the button's own words as
   * the body would leave the timeline full of instructions to the user rather than
   * facts about the lead. So this opens the composer instead of writing anything.
   */
  protected log(lead: Lead): void {
    void this.router.navigate(['/lead', lead.id], { queryParams: { at: 'note' } });
  }

  protected snooze(lead: Lead, due: Date): void {
    void this.store.snooze(lead.id, due);
  }

  protected remove(lead: Lead): void {
    this.store.remove(lead.id);
  }

  protected clearFilters(): void {
    this.store.clearFilters();
    this.clearSourceParam();
  }

  /** Clears only the source filter, leaving search and status untouched. */
  protected clearSource(): void {
    this.store.setSourceFilter('all');
    this.clearSourceParam();
  }

  /** Otherwise a page refresh would re-read the same `?source=` and silently reapply it. */
  private clearSourceParam(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { source: null },
      queryParamsHandling: 'merge',
    });
  }
}
