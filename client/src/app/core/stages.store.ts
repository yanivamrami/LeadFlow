import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';

import { COPY } from './copy';
import { Stage, StageKind, SwatchName } from './lead.model';
import { NotifyService } from './notify.service';
import { AppError, SupabaseService, costsData, isAppError } from './supabase.service';
import { archiveCheck } from './stages.rules';

/** What `create` needs. `kind` is not here — a user-made stage is always `open`; the
 *  won and lost stages are seeded once by signup and never created again (there can only
 *  ever be one of each, enforced by `pipeline_stages_one_won_idx` / `_one_lost_idx`). */
export interface NewStageInput {
  name: string;
  shortName: string | null;
  swatch: SwatchName;
  meaning: string | null;
  guidance: string | null;
  driftDays: number | null;
  expectsReply: boolean;
}

/** Fields the stage manager can edit outside of `rename` and `reorder`. Undefined means
 *  "leave alone" — distinct from `null`, which several of these fields accept as a real value. */
export interface StagePatch {
  swatch?: SwatchName;
  meaning?: string | null;
  guidance?: string | null;
  driftDays?: number | null;
  expectsReply?: boolean;
}

interface StageRow {
  id: string;
  name: string;
  short_name: string | null;
  position: number;
  kind: StageKind;
  swatch: SwatchName;
  meaning: string | null;
  guidance: string | null;
  drift_days: number | null;
  expects_reply: boolean;
  is_system: boolean;
  archived_at: string | null;
}

const SELECT =
  'id, name, short_name, position, kind, swatch, meaning, guidance, drift_days, expects_reply, is_system, archived_at';

/**
 * Pipeline stage state — its own root-provided store, same shape as RemindersStore, and
 * deliberately not part of LeadsStore: the lead sheet, the board, the filter strip, the
 * register's move menu, the insights funnel and the stage manager all need the stage
 * list, and several of those routes never load the pipeline at all
 * (documents/PLAN-stages.md §3).
 */
@Injectable({ providedIn: 'root' })
export class StagesStore {
  private readonly supabase = inject(SupabaseService);
  private readonly notify = inject(NotifyService);

  private readonly _stages = signal<Stage[]>([]);
  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);
  private readonly _failed = signal(false);
  private readonly _busyId = signal<string | null>(null);

  constructor() {
    // Sign-out empties this store for the same reason it empties the pipeline and the
    // reminders: a root singleton would otherwise hand the next user on this browser the
    // previous one's stages. Epoch 0 is the initial value, not a sign-out.
    effect(() => {
      if (this.supabase.sessionEpoch() > 0) untracked(() => this.reset());
    });
  }

  reset(): void {
    this._stages.set([]);
    this._loaded.set(false);
    this._failed.set(false);
    this._loading.set(false);
    this._busyId.set(null);
    // Drop any shared in-flight read too: it belongs to the signed-out user's tenant, and a
    // caller after sign-in must not be handed it.
    this.inFlight = null;
  }

  /** Everything, including archived — most callers want `active` instead. */
  readonly stages = this._stages.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly loadFailed = this._failed.asReadonly();
  readonly busyId = this._busyId.asReadonly();

  readonly active = computed(() =>
    this._stages()
      .filter((s) => s.archivedAt === null)
      .sort((a, b) => a.position - b.position),
  );

  /** The stage new leads land in: the lowest-position live stage with kind `open`. */
  readonly firstOpen = computed(() => this.active().find((s) => s.kind === 'open') ?? null);
  readonly wonStage = computed(() => this.active().find((s) => s.kind === 'won') ?? null);
  readonly lostStage = computed(() => this.active().find((s) => s.kind === 'lost') ?? null);

  /**
   * Includes archived stages, unlike `active`. A timeline entry on a lead can point at a
   * stage that was archived last month, and it must still resolve to a name and a swatch
   * rather than a blank tag — that is the whole reason stages are archived, not deleted.
   */
  byId(id: string): Stage | undefined {
    return this._stages().find((s) => s.id === id);
  }

  /* ---------- read ---------- */

  /**
   * Stages are the one read several unrelated callers need at once: LeadsStore awaits them
   * before folding rows, the Shell's reminders load runs on every route, and the stage
   * manager loads them for itself. A plain `if (loading) return` guard would let the second
   * caller's `await` resolve immediately while the first request is still in flight, so it
   * would carry on with an empty stage list. Sharing the in-flight promise makes every
   * caller wait for the same answer instead — one request, and nobody proceeds early.
   */
  private inFlight: Promise<void> | null = null;

  load(): Promise<void> {
    this.inFlight ??= this.read().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async read(): Promise<void> {
    this._loading.set(true);
    this._failed.set(false);

    try {
      const tenantId = await this.requireTenant();
      const rows = await this.supabase.run<StageRow[]>(
        this.table()
          .select(SELECT)
          .eq('tenant_id', tenantId)
          .order('position', { ascending: true })
          .order('created_at', { ascending: true }) as never,
      );
      this._stages.set((rows ?? []).map((row) => this.toStage(row)));
      this._loaded.set(true);
    } catch (error) {
      this._failed.set(true);
      this.report(error, false);
    } finally {
      this._loading.set(false);
    }
  }

  /* ---------- writes ---------- */

  /**
   * Appends a new open stage after every existing position, including won's and lost's.
   * Slotting it in earlier would mean shifting other rows out of the way first, and that
   * cannot be done safely in one write — see `reorder`'s comment for why. The manager's
   * drag-to-reorder is the intended way to place a new stage properly once it exists.
   */
  async create(input: NewStageInput): Promise<string | null> {
    if (!this.notify.online()) {
      this.notify.blockedOffline();
      return null;
    }

    this._busyId.set('create');
    try {
      const tenantId = await this.requireTenant();
      const rows = await this.supabase.run<{ id: string }[]>(
        this.table()
          .insert({
            tenant_id: tenantId,
            name: input.name,
            short_name: input.shortName,
            position: this.nextPosition(),
            kind: 'open',
            swatch: input.swatch,
            meaning: input.meaning,
            guidance: input.guidance,
            drift_days: input.driftDays,
            expects_reply: input.expectsReply,
            is_system: false,
          })
          .select('id') as never,
      );
      await this.reload();
      this.notify.succeeded(COPY.stages.created(input.name));
      return rows?.[0]?.id ?? null;
    } catch (error) {
      // A create that fails leaves nothing behind, and the user still has the form open —
      // same reasoning as LeadsStore.createLead: this announces rather than interrupting.
      this.report(error, false);
      return null;
    } finally {
      this._busyId.set(null);
    }
  }

  rename(id: string, name: string, shortName: string | null): Promise<boolean> {
    const stage = this.byId(id);
    if (!stage) return Promise.resolve(false);

    return this.commit(
      id,
      name,
      () =>
        this.supabase.run(
          this.table().update({ name, short_name: shortName }).eq('id', id) as never,
        ),
      () => this.notify.succeeded(COPY.stages.renamed),
    );
  }

  /** Swatch, teaching copy, drift and expects-reply — everything `rename` does not touch. */
  update(id: string, patch: StagePatch): Promise<boolean> {
    const stage = this.byId(id);
    if (!stage) return Promise.resolve(false);

    const payload: Record<string, unknown> = {};
    if (patch.swatch !== undefined) payload['swatch'] = patch.swatch;
    if (patch.meaning !== undefined) payload['meaning'] = patch.meaning;
    if (patch.guidance !== undefined) payload['guidance'] = patch.guidance;
    if (patch.driftDays !== undefined) payload['drift_days'] = patch.driftDays;
    if (patch.expectsReply !== undefined) payload['expects_reply'] = patch.expectsReply;

    return this.commit(
      id,
      stage.name,
      () => this.supabase.run(this.table().update(payload).eq('id', id) as never),
      () => this.notify.succeeded(COPY.stages.updated),
    );
  }

  /**
   * Writes the complete new order in one call.
   *
   * `reorder_stages` (20260804090400) takes the whole ordered list rather than a diff and
   * rewrites `position` from the array index. Two reasons it is an RPC and not a loop of
   * updates: `pipeline_stages_tenant_position_idx` is unique among live stages, so a
   * straight swap has the second write collide with the first's still-live position and the
   * dodge is to park every row negative first — a two-pass sequence that, done over the
   * wire, can fail between passes and leave the entire pipeline sitting at negative
   * positions with no obvious way for the user to recover. Inside one transaction nobody
   * ever observes that state.
   *
   * The RPC also refuses a partial list, which the client could not check for itself
   * without trusting its own possibly-stale copy of the order.
   */
  reorder(orderedIds: readonly string[]): Promise<boolean> {
    return this.commit(
      'reorder',
      COPY.stages.pipelineSubject,
      async () => {
        const tenantId = await this.requireTenant();
        await this.supabase.run(
          this.rpc()('reorder_stages', {
            p_tenant_id: tenantId,
            p_stage_ids: [...orderedIds],
          }) as never,
        );
      },
      () => this.notify.succeeded(COPY.stages.reordered),
    );
  }

  /**
   * Archives a stage, moving its leads to `destinationId` first when it has any
   * (documents/PLAN-stages.md §4.1). `archiveCheck` runs again here as the store's own
   * backstop — the caller (the stage manager) is expected to have already run it to
   * decide what the button says, but a rule this cheap is worth re-asserting rather than
   * trusting the caller blindly.
   *
   * One call, not two: moving the leads and retiring the stage are one user gesture, and
   * doing them as separate round trips means a failure between them leaves the leads moved
   * while the stage is still live — the user asked for one thing and silently got half of
   * it. `archive_stage` (20260804090400) does both in a transaction, and re-asserts the
   * three refusals server-side, because a rule enforced only in a client is one PostgREST
   * call away from not being enforced at all.
   */
  async archive(id: string, leadCount: number, destinationId: string | null): Promise<boolean> {
    const stage = this.byId(id);
    if (!stage) return false;

    const verdict = archiveCheck(stage, leadCount, this._stages());
    if (typeof verdict === 'object') {
      this.notify.failed(verdict.refused);
      return false;
    }
    if (verdict === 'needs-destination' && !destinationId) {
      // The manager's button should already be disabled until a destination is chosen —
      // this is the backstop, not the primary guard.
      this.notify.failed(COPY.stages.archiveNeedsDestination(leadCount));
      return false;
    }

    return this.commit(
      id,
      stage.name,
      async () => {
        await this.supabase.run(
          this.rpc()('archive_stage', {
            p_stage_id: id,
            // Explicitly null for an empty stage: the RPC rejects a destination it was not
            // asked for, because a caller passing one believes leads are there.
            p_destination_id: leadCount > 0 ? destinationId : null,
          }) as never,
        );
      },
      () => this.notify.succeeded(COPY.stages.archivedNotice(stage.name)),
    );
  }

  /* ---------- plumbing ---------- */

  /** One past the highest position any row holds, archived included — always free. */
  private nextPosition(): number {
    const positions = this._stages().map((s) => s.position);
    return positions.length ? Math.max(...positions) + 1 : 0;
  }

  private toStage(row: StageRow): Stage {
    return {
      id: row.id,
      name: row.name,
      shortName: row.short_name,
      position: row.position,
      kind: row.kind,
      swatch: row.swatch,
      meaning: row.meaning,
      guidance: row.guidance,
      driftDays: row.drift_days,
      expectsReply: row.expects_reply,
      isSystem: row.is_system,
      archivedAt: row.archived_at ? new Date(row.archived_at) : null,
    };
  }

  private async reload(): Promise<void> {
    const tenantId = await this.requireTenant();
    const rows = await this.supabase.run<StageRow[]>(
      this.table()
        .select(SELECT)
        .eq('tenant_id', tenantId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true }) as never,
    );
    this._stages.set((rows ?? []).map((row) => this.toStage(row)));
  }

  /**
   * Same shape as RemindersStore.commit: offline blocks up front, a failure routes
   * through `report` for severity, and success always re-reads rather than patching
   * locally — position and archive state are exactly the fields a half-applied write
   * would get wrong, and the server's answer is the only trustworthy one.
   */
  private async commit(
    busyKey: string,
    subject: string,
    write: () => Promise<unknown>,
    onSuccess?: () => void,
  ): Promise<boolean> {
    if (!this.notify.online()) {
      this.notify.blockedOffline();
      return false;
    }

    this._busyId.set(busyKey);
    const run = async () => {
      await write();
      await this.reload();
    };

    try {
      await run();
      onSuccess?.();
      return true;
    } catch (error) {
      this.report(error, true, subject, run);
      return false;
    } finally {
      this._busyId.set(null);
    }
  }

  private report(
    error: unknown,
    wasWrite: boolean,
    subject?: string,
    retry?: () => Promise<void>,
  ): void {
    const appError: AppError = isAppError(error)
      ? error
      : { message: COPY.errors.generic, code: 'unknown', cause: error };

    if (wasWrite && subject && retry && costsData(appError, true)) {
      this.notify.failedToPersist({ subject, run: retry }, appError.code);
      return;
    }
    this.notify.failed(appError.message);
  }

  private async requireTenant(): Promise<string> {
    const tenantId = await this.supabase.resolveTenantId();
    if (!tenantId) {
      throw { message: COPY.errors.notAllowed, code: '42501', cause: null } satisfies AppError;
    }
    return tenantId;
  }

  /**
   * pipeline_stages, `reorder_stages` and `archive_stage` are not yet in the generated
   * Database types: the migrations that add them have not been run against the project
   * those types were regenerated from. Same widening leads.store.ts's `rpc()` uses for its
   * two RPCs; regenerating the types after these migrations ship removes all three helpers.
   */
  private table() {
    return this.raw().from('pipeline_stages');
  }

  private raw(): { from: (name: string) => any } {
    return this.supabase.client as unknown as { from: (name: string) => any };
  }

  private rpc(): (name: string, args: Record<string, unknown>) => unknown {
    return (name, args) =>
      (this.supabase.client as unknown as {
        rpc: (n: string, a: Record<string, unknown>) => unknown;
      }).rpc(name, args);
  }
}
