import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragPlaceholder,
  CdkDragPreview,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';

import { LucideChevronDown } from '@lucide/angular';

import { COPY } from '../../core/copy';
import { Stage } from '../../core/lead.model';
import { NewStageInput, StagePatch, StagesStore } from '../../core/stages.store';
import { SupabaseService } from '../../core/supabase.service';
import { StageTag } from '../../shared/stage-tag';
import { AddStage } from './add-stage';
import { AutomationsPanel } from './automations-panel';
import { COPY_STAGES } from './stages.copy';
import { StageRow } from './stage-row';

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
 */
@Component({
  selector: 'lf-stages',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CdkDropList,
    CdkDrag,
    CdkDragPlaceholder,
    CdkDragPreview,
    LucideChevronDown,
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
  protected readonly stageRows = computed<{ stage: Stage; leadCount: number | null }[]>(() => {
    const counts = this.leadCounts();
    return this.rows().map((stage) => ({
      stage,
      leadCount: counts ? (counts.get(stage.id) ?? 0) : null,
    }));
  });

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
