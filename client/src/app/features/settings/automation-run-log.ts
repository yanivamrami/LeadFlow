import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import { Automation, AutomationsStore, AutomationRun } from '../../core/automations.store';
import { Stage } from '../../core/lead.model';
import { SupabaseService } from '../../core/supabase.service';
import { COPY_AUTOMATIONS } from './automations.copy';

interface DryRunLead {
  id: string;
  name: string;
}

/** A run with its display strings resolved — see `displayRuns` below. */
interface RunRow {
  run: AutomationRun;
  statusLabel: string;
  leadLabel: string;
  when: string;
}

/**
 * SCREENS 9.4 — the run log and the dry run, both per rule. "Not optional": this is the
 * only place a user can discover that their webhook endpoint has been failing for a week
 * (documents/PLAN-automations.md §4), so it ships with the same four states everything
 * else in this product reads closely does — loading skeleton, empty, load-failure with
 * retry, populated — and it never renders the empty state over a failed read
 * (SCREENS 2.9): `runsFailed` is checked first, unconditionally.
 *
 * The dry run here is a **client-side simulation**, not a real server-side dry run: a
 * true one would need a `dry_run` branch inside `fire_automation_run` (20260804091100),
 * which this agent does not own and which does not exist today. What this offers instead
 * is the same restatement sentence the row already shows, addressed to a lead the user
 * picks, with an explicit, un-missable disclaimer that nothing was sent, written, or
 * logged. That limitation is called out again in the hand-off report — a fake "it worked"
 * would be worse than admitting the gap.
 */
@Component({
  selector: 'lf-automation-run-log',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './automation-run-log.html',
  styleUrl: './automation-run-log.scss',
})
export class AutomationRunLog {
  private readonly store = inject(AutomationsStore);
  private readonly supabase = inject(SupabaseService);

  protected readonly copy = COPY_AUTOMATIONS;

  readonly automation = input.required<Automation>();
  /** The already-built restatement — reused rather than recomputed here, since
   *  `AutomationRow` already resolved member/stage names to build it once. */
  readonly ruleSentence = input.required<string>();
  readonly stage = input.required<Stage>();

  protected readonly open = signal(false);

  protected readonly runsLoading = signal(false);
  protected readonly runsLoaded = signal(false);
  protected readonly runsFailed = signal(false);
  protected readonly runs = signal<AutomationRun[]>([]);

  protected readonly dryOpen = signal(false);
  protected readonly leads = signal<DryRunLead[] | null>(null);
  protected readonly leadsFailed = signal(false);
  protected readonly selectedLeadId = signal('');
  protected readonly dryResult = signal<string | null>(null);

  protected toggle(): void {
    this.open.update((v) => !v);
    if (this.open() && !this.runsLoaded() && !this.runsLoading()) void this.loadRuns();
  }

  protected retryRuns(): void {
    void this.loadRuns();
  }

  protected toggleDryRun(): void {
    this.dryOpen.update((v) => !v);
    this.dryResult.set(null);
    if (this.dryOpen() && this.leads() === null && !this.leadsFailed()) void this.loadLeads();
  }

  protected retryLeads(): void {
    void this.loadLeads();
  }

  protected runDryRun(): void {
    const leadId = this.selectedLeadId();
    const lead = this.leads()?.find((l) => l.id === leadId);
    if (!lead) return;
    this.dryResult.set(this.copy.dryRunResult(lead.name, this.ruleSentence()));
  }

  /**
   * One row's status label, lead name and timestamp, resolved once per change instead of
   * three method calls per row per change-detection pass — the list renders up to 50 runs,
   * so a per-row lookup here is the one that actually costs something.
   *
   * `when` stays a plain field on this view model rather than a pipe: unlike `lfWhen` it
   * does not read a clock (it always prints the absolute date/time, never "today"), so it
   * is a pure function of `createdAt` alone and has exactly one call site — introducing a
   * pipe for a single consumer would be indirection with no reuse to justify it.
   */
  protected readonly displayRuns = computed<RunRow[]>(() =>
    this.runs().map((run) => ({
      run,
      statusLabel: this.copy.runStatus[run.status],
      leadLabel: run.leadName ?? this.copy.runLeadFallback,
      when: run.createdAt.toLocaleString('he-IL', {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      }),
    })),
  );

  private async loadRuns(): Promise<void> {
    this.runsLoading.set(true);
    this.runsFailed.set(false);
    try {
      const rows = await this.store.fetchRuns(this.automation().id);
      this.runs.set(rows);
      this.runsLoaded.set(true);
    } catch {
      this.runsFailed.set(true);
    } finally {
      this.runsLoading.set(false);
    }
  }

  private async loadLeads(): Promise<void> {
    this.leadsFailed.set(false);
    try {
      const tenantId = await this.supabase.resolveTenantId();
      if (!tenantId) throw new Error('no tenant');

      const rows = await this.supabase.run<{ id: string; name: string }[]>(
        this.raw()
          .from('leads')
          .select('id, name')
          .eq('tenant_id', tenantId)
          .eq('stage_id', this.stage().id)
          .order('name', { ascending: true })
          .limit(200) as never,
      );
      this.leads.set(rows ?? []);
    } catch {
      this.leadsFailed.set(true);
    }
  }

  /** Same escape hatch `Stages` uses for its own bespoke `leads` read: `stage_id` predates
   *  the generated Database types (documents/CONTRACT-stages.md §1). */
  private raw(): { from: (name: string) => any } {
    return this.supabase.client as unknown as { from: (name: string) => any };
  }
}
