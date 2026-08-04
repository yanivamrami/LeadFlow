import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { COPY, SOURCE_LABEL } from '../../core/copy';
import { InsightsStore } from '../../core/insights.store';
import { Stage } from '../../core/lead.model';
import { ValuePipe } from '../../shared/format.pipes';

/**
 * Insights — the PRD's fourth pillar. Read mode: the visitor came to understand, so
 * comprehension outranks density and every figure carries a line saying what it means.
 *
 * Two deliberate departures, both recorded in docs:
 *
 * 1. Conversion is won ÷ *decided*, not won ÷ total as the PRD words it. Counting
 *    still-open leads as failures shows a beginner a punishing number with no
 *    explanation, which is the opposite of the encouragement this pillar exists for.
 *    The figure names its own denominator on screen so it cannot be misread.
 *
 * 2. The charts are semantic HTML, not canvas, where ARCHITECTURE.md maps analytics to
 *    PrimeNG Chart. A labelled bar per pipeline stage is a list: readable by a screen
 *    reader, selectable, printable, and styleable by the same tokens as everything else.
 *    Chart.js earns its place when a real time-series arrives.
 */
@Component({
  selector: 'lf-insights',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ValuePipe],
  templateUrl: './insights.html',
  styleUrl: './insights.scss',
})
export class Insights {
  private readonly store = inject(InsightsStore);

  protected readonly copy = COPY;
  protected readonly sourceLabel = SOURCE_LABEL;

  protected readonly stats = this.store.stats;
  protected readonly loading = this.store.loading;
  protected readonly failed = this.store.failed;
  protected readonly conversion = this.store.conversion;
  protected readonly sources = this.store.sources;
  protected readonly canCompare = this.store.canCompare;
  protected readonly shortBy = this.store.decidedShortBy;

  /** How many more decided leads before a comparison is worth showing. */
  protected readonly thinBodyText = computed(() => COPY.insights.thinBody(this.shortBy()));

  protected readonly skeletonBands = [0, 1, 2];

  /**
   * `copy.insights.totalMeaning`/`conversionMeaning` are functions of store values, so calling
   * them from the binding re-ran them on every change-detection pass even though `stats()`
   * changes only once per load. Resolved here instead, once per actual change.
   */
  protected readonly totalMeaning = computed(() => {
    const s = this.stats();
    return s ? this.copy.insights.totalMeaning(s.open) : '';
  });
  protected readonly conversionMeaning = computed(() => {
    const s = this.stats();
    return s ? this.copy.insights.conversionMeaning(s.won, s.decided) : '';
  });

  /**
   * The store's `flow` rows plus the css class each bar renders with. Extended here rather
   * than on `InsightsStore.flow` itself: `barClass` is a presentation concern (which swatch
   * class a `<span>` gets), not a statistic, and keeping it in the component keeps the store
   * free of view-layer detail.
   */
  protected readonly flow = computed(() =>
    this.store.flow().map((row) => ({ ...row, barClass: this.barClassFor(row.stage) })),
  );

  constructor() {
    void this.store.load();
  }

  protected retry(): void {
    void this.store.load();
  }

  /**
   * The pipeline ramp, so a bar means the same thing here as a tag does elsewhere. `kind`
   * overrides the stage's own swatch for won/lost, same rule as `lf-stage-tag`: won always
   * takes the red fill, lost always takes the dashed outline, regardless of what colour the
   * stage itself was given — colour follows what the stage *means*, not its label.
   */
  private barClassFor(stage: Stage): string {
    if (stage.kind === 'won') return 'bar__fill bar__fill--won';
    if (stage.kind === 'lost') return 'bar__fill bar__fill--lost';
    return `bar__fill bar__fill--sw-${stage.swatch}`;
  }
}
