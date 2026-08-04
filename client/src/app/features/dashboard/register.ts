import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { COPY, SORT_LABEL, SOURCE_LABEL } from '../../core/copy';
import { Attention, Lead, SORT_KEYS, SortKey, Stage } from '../../core/lead.model';
import { LeadsStore } from '../../core/leads.store';
import { LeadMenu } from '../../shared/lead-menu';
import { ValuePipe, WhenPipe } from '../../shared/format.pipes';
import { StageTag } from '../../shared/stage-tag';

/** A lead with its urgency flag and silence count already decided — see `rows`. */
export interface RegisterRow {
  lead: Lead;
  attention: Attention;
  silentDays: number;
}

/**
 * The register — every lead, ranked by urgency. Attention is a flag stuck to the row's
 * inline-start edge: solid yellow means "needs you", hatched means "drifting". Texture and
 * fill differ, not only hue, so the distinction survives greyscale and colour blindness.
 */
@Component({
  selector: 'lf-register',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, StageTag, LeadMenu, ValuePipe, WhenPipe],
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

  protected readonly leads = this.store.visibleLeads;
  protected readonly total = this.store.total;

  /** "showing N of M" under the list, resolved once per change rather than per CD pass. */
  protected readonly showingNote = computed(() =>
    COPY.register.showing(this.leads().length, this.total()),
  );
  protected readonly isFiltered = this.store.isFiltered;
  protected readonly loading = this.store.loading;
  protected readonly loaded = this.store.loaded;
  protected readonly sort = this.store.sort;
  /** The clock last-touch stamps are measured against; the pipe takes it as an argument. */
  protected readonly now = this.store.now;
  /** Placeholder rows while the first read is in flight. */
  protected readonly skeletonRows = [0, 1, 2, 3, 4, 5];

  /**
   * A filter the user cannot see is one they will not think to remove — this names it,
   * so it only renders once the source actually is filtered. Resolved to the final copy
   * string here rather than in the template, which previously called `sourceFilter(label)`
   * on every change-detection pass.
   */
  protected readonly sourceFilterText = computed(() => {
    const source = this.store.sourceFilter();
    if (source === 'all') return null;
    return COPY.register.sourceFilter(this.sourceLabel[source]);
  });

  /**
   * Every visible lead paired with its urgency flag and silence count. `attentionOf` and
   * `ageInDays` both read the store's clock, so calling them from the template ran them
   * per row, per binding, on every change-detection pass; this derives both once per change.
   */
  protected readonly rows = computed<RegisterRow[]>(() => {
    const now = this.store.now();
    return this.leads().map((lead) => ({
      lead,
      attention: this.store.attentionOf(lead, now),
      silentDays: this.store.ageInDays(lead, now),
    }));
  });

  protected setSort(value: string): void {
    this.store.setSort(value as SortKey);
  }

  protected move(lead: Lead, stage: Stage): void {
    this.store.moveToStage(lead.id, stage);
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
