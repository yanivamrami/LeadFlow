import { Injectable, computed, inject, signal } from '@angular/core';

import { COPY } from './copy';
import { LeadSource, LeadStatus } from './lead.model';
import { LeadsStore } from './leads.store';
import { NotifyService } from './notify.service';
import { AppError, SupabaseService, isAppError } from './supabase.service';

/** What lead_stats() returns. Aggregated server-side, in one round trip. */
export interface LeadStats {
  total: number;
  won: number;
  lost: number;
  decided: number;
  open: number;
  open_value: number;
  won_value: number;
  by_status: Partial<Record<LeadStatus, number>> | null;
  reached: Partial<Record<LeadStatus, number>> | null;
  sources: { source: LeadSource; total: number; won: number; lost: number }[];
}

/**
 * Below this many *decided* leads, no comparison between groups is shown — not even
 * with a caveat. A ratio built on four outcomes is noise wearing a percentage sign,
 * and people remember the number long after they forget the disclaimer.
 *
 * A judgement call, not a derived constant. Revisit against real usage.
 */
export const MIN_DECIDED_FOR_COMPARISON = 10;

@Injectable({ providedIn: 'root' })
export class InsightsStore {
  private readonly supabase = inject(SupabaseService);
  private readonly notify = inject(NotifyService);
  private readonly leads = inject(LeadsStore);

  private readonly _stats = signal<LeadStats | null>(null);
  private readonly _loading = signal(false);
  private readonly _failed = signal(false);

  readonly stats = this._stats.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly failed = this._failed.asReadonly();

  /** True once there is enough decided history for a comparison to mean anything. */
  readonly canCompare = computed(
    () => (this._stats()?.decided ?? 0) >= MIN_DECIDED_FOR_COMPARISON,
  );

  readonly decidedShortBy = computed(() =>
    Math.max(0, MIN_DECIDED_FOR_COMPARISON - (this._stats()?.decided ?? 0)),
  );

  /** Won ÷ decided. Null when nothing has been decided — 0% would be a lie about effort. */
  readonly conversion = computed(() => {
    const s = this._stats();
    if (!s || s.decided === 0) return null;
    return Math.round((s.won / s.decided) * 100);
  });

  /** Stage reach in pipeline order, with the widest bar as the scale. */
  readonly flow = computed(() => {
    const reached = this._stats()?.reached ?? {};
    const rows = (['new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost'] as const).map(
      (status) => ({ status, leads: reached[status] ?? 0 }),
    );
    const max = Math.max(1, ...rows.map((r) => r.leads));
    return rows.map((r) => ({ ...r, share: Math.round((r.leads / max) * 100) }));
  });

  /** Sources with a close rate. Rate is only computed where the source has outcomes. */
  readonly sources = computed(() =>
    (this._stats()?.sources ?? []).map((s) => {
      const decided = s.won + s.lost;
      return { ...s, decided, rate: decided > 0 ? Math.round((s.won / decided) * 100) : null };
    }),
  );

  async load(): Promise<void> {
    if (this._loading()) return;
    this._loading.set(true);
    this._failed.set(false);

    try {
      const tenantId = await this.tenantId();
      const client = this.supabase.client as unknown as {
        rpc: (name: string, params: Record<string, unknown>) => unknown;
      };
      const stats = await this.supabase.run<LeadStats>(
        client.rpc('lead_stats', { p_tenant_id: tenantId }) as never,
      );
      this._stats.set(stats);
    } catch (error) {
      this._failed.set(true);
      const mapped: AppError = isAppError(error)
        ? error
        : { message: COPY.errors.generic, code: 'unknown', cause: error };
      // A failed read costs a refresh, never data, so it announces rather than interrupts.
      this.notify.failed(mapped.message);
    } finally {
      this._loading.set(false);
    }
  }

  /** Reuses the tenant the dashboard already resolved rather than asking again. */
  private async tenantId(): Promise<string> {
    const known = this.leads.tenantId();
    if (known) return known;

    const rows = await this.supabase.run<{ tenant_id: string }[]>(
      this.supabase.client.from('memberships').select('tenant_id').limit(1) as never,
    );
    const id = rows?.[0]?.tenant_id;
    if (!id) throw { message: COPY.errors.notAllowed, code: '42501', cause: null } satisfies AppError;
    return id;
  }
}
