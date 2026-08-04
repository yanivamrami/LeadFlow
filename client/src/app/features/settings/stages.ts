import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragPlaceholder,
  CdkDragPreview,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { map } from 'rxjs';

import { LucideChevronDown, LucideGripVertical } from '@lucide/angular';

import { COPY } from '../../core/copy';
import { Stage } from '../../core/lead.model';
import { NewStageInput, StagePatch, StagesStore } from '../../core/stages.store';
import { SupabaseService } from '../../core/supabase.service';
import { StageTag } from '../../shared/stage-tag';
import { AddStage } from './add-stage';
import { AutomationsPanel } from './automations-panel';
import { COPY_STAGES } from './stages.copy';
import { StageRow } from './stage-row';

/** One roster strip's worth of resolved data — see `Stages.stageRows`. */
interface StageRowView {
  stage: Stage;
  /** `null` = still counting. */
  leadCount: number | null;
  dragLabel: string;
  countLabel: string;
  /** `null` when the stage never counts as quiet, so the strip shows no drift chip. */
  daysLabel: string | null;
}

/**
 * SCREENS 9.1 — the stage manager. Owner-only for writes (documents/CONTRACT-stages.md
 * §1's RLS: insert/update/delete on `pipeline_stages` require `is_tenant_owner`, reads
 * stay member-level), but nothing here has to know that: a member's write attempt comes
 * back as a normal `42501`, which `SupabaseService.fromPostgrest` already maps to
 * `COPY.errors.notAllowed` and `StagesStore.commit` already renders as a toast — the same
 * path any other failed write takes. No special-casing needed on this screen.
 *
 * Lead counts per stage are not something `StagesStore` exposes (it is a pipeline-shape
 * store, not a leads one, and this agent does not own `leads.store.ts`), so this screen
 * reads them itself with the one query that is cheap enough to justify a bespoke read: all
 * of a tenant's `stage_id` values, counted client-side. That is also the only correct way
 * to answer "how many leads would move" for the archive gate before the user commits.
 *
 * ## Layout: one roster, two shapes
 *
 * The screen has two jobs that used to fight over one column — *shape the pipeline*
 * (order it, compare stages, see where leads sit) and *author one stage* (names, timing,
 * teaching copy, rules). Both shapes below express the same state, `openId`:
 *
 * - **≥900px** — a roster rail beside an editor pane. `openId` is which stage the pane
 *   holds; `selectedRow` falls back to the first row so the pane is never empty, which
 *   also self-heals when the open stage is archived out from under it.
 * - **<900px** — the roster *is* the page, and `openId` is the one stage expanded in
 *   place underneath its own strip. `null` means everything is collapsed, so the phone
 *   opens on the pipeline rather than on a wall of form fields.
 *
 * Exactly one `lf-stage-row` is instantiated either way: the branch is an `@if` on
 * `wide()`, not two copies of the form hidden from each other by CSS, which would double
 * every input's name and every commit-on-blur handler.
 */
@Component({
  selector: 'lf-stages',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    CdkDropList,
    CdkDrag,
    CdkDragPlaceholder,
    CdkDragPreview,
    LucideChevronDown,
    LucideGripVertical,
    StageTag,
    StageRow,
    AddStage,
    AutomationsPanel,
  ],
  templateUrl: './stages.html',
  styleUrl: './stages.scss',
})
export class Stages {
  private readonly supabase = inject(SupabaseService);
  private readonly breakpoints = inject(BreakpointObserver);
  protected readonly stagesStore = inject(StagesStore);

  protected readonly copy = COPY;
  protected readonly copyStages = COPY_STAGES;

  protected readonly loading = this.stagesStore.loading;
  protected readonly loaded = this.stagesStore.loaded;
  protected readonly loadFailed = this.stagesStore.loadFailed;
  protected readonly active = this.stagesStore.active;
  protected readonly all = this.stagesStore.stages;
  protected readonly archivedStages = computed(() =>
    this.all().filter((s) => s.archivedAt !== null),
  );

  protected readonly skeletonRows = [0, 1, 2, 3];
  protected readonly archivedOpen = signal(false);

  /**
   * The 900px line the brief draws. `BreakpointObserver` rather than a bare media query
   * in the stylesheet because the two shapes are different *templates*, not one template
   * restyled — see the class comment.
   */
  protected readonly wide = toSignal(
    this.breakpoints.observe('(min-width: 900px)').pipe(map((state) => state.matches)),
    { initialValue: this.breakpoints.isMatched('(min-width: 900px)') },
  );

  /** Which stage is under the cursor of attention: the pane's contents on desktop, the
   *  one expanded strip on mobile. Null only ever means "mobile, nothing open". */
  protected readonly openId = signal<string | null>(null);

  /** Optimistic reorder: `active()` only reflects the new order after the store's reload
   *  completes, and that round trip is two writes per row (StagesStore.reorder's own
   *  comment explains why). Without this, a drop would visually snap back and then jump
   *  forward again once the network catches up. */
  private readonly localOrder = signal<Stage[] | null>(null);
  protected readonly rows = computed(() => this.localOrder() ?? this.active());

  /** `null` = still counting. A stage id absent from the map once loaded means zero. */
  private readonly leadCounts = signal<Map<string, number> | null>(null);
  private readonly _leadCountsFailed = signal(false);
  protected readonly leadCountsFailed = this._leadCountsFailed.asReadonly();

  /** Each row paired with its own count, resolved once per change instead of a `Map.get`
   *  per row per change-detection pass — `leadCountFor` stays below for `onArchive`'s own
   *  one-off read, which is plain TS code on a click, not a per-pass template binding. */
  protected readonly stageRows = computed<StageRowView[]>(() => {
    const counts = this.leadCounts();
    return this.rows().map((stage) => {
      const leadCount = counts ? (counts.get(stage.id) ?? 0) : null;
      return {
        stage,
        leadCount,
        // The strip's own sentences, resolved per stage instead of per change-detection
        // pass. `countLabel` is the roster's only accessible reading of the bare number
        // beside each strip, so it is not decoration — see `stages.html`.
        dragLabel: this.copyStages.dragHandleLabel(stage.name),
        countLabel:
          leadCount === null
            ? this.copyStages.leadCountUnknown
            : this.copyStages.leadCount(leadCount),
        daysLabel: stage.driftDays === null ? null : this.copyStages.stripDays(stage.driftDays),
      };
    });
  });

  /**
   * The row the desktop pane holds. Falls back to the first row rather than rendering an
   * empty pane, which makes two states correct for free: the first paint (nothing picked
   * yet) and the moment the open stage is archived and leaves `stageRows()` entirely.
   */
  protected readonly selectedRow = computed<StageRowView | null>(() => {
    const rows = this.stageRows();
    const id = this.openId();
    return rows.find((row) => row.stage.id === id) ?? rows[0] ?? null;
  });

  /** The pane's stage id, so the roster can mark the current strip without an optional
   *  chain re-walked per strip per change-detection pass. */
  protected readonly selectedId = computed(() => this.selectedRow()?.stage.id ?? null);

  constructor() {
    void this.stagesStore.load();
    void this.loadLeadCounts();
  }

  /** Used only from `onArchive`'s own click handler now — the template reads counts off
   *  `stageRows()` instead. */
  private leadCountFor(stageId: string): number | null {
    const counts = this.leadCounts();
    if (!counts) return null;
    return counts.get(stageId) ?? 0;
  }

  protected retryStages(): void {
    void this.stagesStore.load();
  }

  protected retryLeadCounts(): void {
    void this.loadLeadCounts();
  }

  protected toggleArchived(): void {
    this.archivedOpen.update((v) => !v);
  }

  /**
   * One strip, one handler, two meanings — because the two layouts mean different things
   * by "activate". On desktop the pane always holds something, so activating a strip
   * loads it and never unloads it; on mobile the strip owns a disclosure, so activating
   * the open one closes it and returns the visitor to the pipeline.
   */
  protected activate(stageId: string): void {
    if (this.wide()) {
      this.openId.set(stageId);
      return;
    }
    this.openId.update((current) => (current === stageId ? null : stageId));
  }

  protected isOpen(stageId: string): boolean {
    return this.openId() === stageId;
  }

  protected async onDrop(event: CdkDragDrop<Stage[]>): Promise<void> {
    if (event.previousIndex === event.currentIndex) return;
    const next = this.rows().slice();
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    this.localOrder.set(next);
    await this.stagesStore.reorder(next.map((s) => s.id));
    this.localOrder.set(null); // active() is authoritative again, whichever way the write went
  }

  protected async onRenamed(
    stage: Stage,
    value: { name: string; shortName: string | null },
  ): Promise<void> {
    await this.stagesStore.rename(stage.id, value.name, value.shortName);
  }

  protected async onPatched(stage: Stage, patch: StagePatch): Promise<void> {
    await this.stagesStore.update(stage.id, patch);
  }

  protected async onArchive(stage: Stage, destinationId: string | null): Promise<void> {
    const count = this.leadCountFor(stage.id) ?? 0;
    const ok = await this.stagesStore.archive(stage.id, count, destinationId);
    // The destination stage's own count just changed too — re-count rather than patch
    // the map by hand, which would drift the moment two rows archive in a row.
    if (ok) void this.loadLeadCounts();
  }

  protected async onCreate(input: NewStageInput): Promise<void> {
    await this.stagesStore.create(input);
  }

  private async loadLeadCounts(): Promise<void> {
    this._leadCountsFailed.set(false);
    try {
      const tenantId = await this.supabase.resolveTenantId();
      if (!tenantId) throw new Error('no tenant');

      const rows = await this.supabase.run<{ stage_id: string }[]>(
        this.raw().from('leads').select('stage_id').eq('tenant_id', tenantId) as never,
      );
      const map = new Map<string, number>();
      for (const row of rows ?? []) map.set(row.stage_id, (map.get(row.stage_id) ?? 0) + 1);
      this.leadCounts.set(map);
    } catch {
      this._leadCountsFailed.set(true);
    }
  }

  /**
   * Same escape hatch `StagesStore.raw()` uses: `leads.stage_id` predates the generated
   * Database types, because the migration that adds it has not landed against the
   * project those types were regenerated from (documents/CONTRACT-stages.md §1).
   * Regenerating the types after that migration ships removes this.
   */
  private raw(): { from: (name: string) => any } {
    return this.supabase.client as unknown as { from: (name: string) => any };
  }
}
