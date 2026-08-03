import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { Automation, TenantMember } from '../../core/automations.store';
import { Stage } from '../../core/lead.model';
import { AutomationEditor, AutomationSaveEvent } from './automation-editor';
import { AutomationRunLog } from './automation-run-log';
import { COPY_AUTOMATIONS, describeAutomation } from './automations.copy';

/**
 * One rule, on one stage — SCREENS 9.2. The plain-Hebrew restatement is the primary
 * content of the row, not a caption under some structured trigger/action display: "a rule
 * the user cannot read back is a rule they will not trust" (documents/PLAN-automations.md
 * §4). Suspended is visibly distinct from disabled — see the badge below and the migration
 * comment on `automations.suspended_at` this whole distinction exists to honour.
 */
@Component({
  selector: 'lf-automation-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AutomationEditor, AutomationRunLog],
  templateUrl: './automation-row.html',
  styleUrl: './automation-row.scss',
})
export class AutomationRow {
  protected readonly copy = COPY_AUTOMATIONS;

  readonly automation = input.required<Automation>();
  readonly stage = input.required<Stage>();
  readonly allStages = input.required<readonly Stage[]>();
  readonly members = input<TenantMember[] | null>(null);
  readonly membersFailed = input(false);
  readonly busy = input(false);
  /** Archived-stage mode: read-only display plus delete, no toggle, no edit, no run log —
   *  editing or testing a rule against a stage that no longer exists in the pipeline would
   *  invite exactly the confusion suspension exists to prevent. */
  readonly readOnly = input(false);

  readonly toggled = output<boolean>();
  readonly saved = output<AutomationSaveEvent>();
  readonly deleted = output<void>();

  protected readonly editing = signal(false);
  protected readonly deleteConfirm = signal(false);

  protected readonly sentence = computed(() =>
    describeAutomation(
      this.automation(),
      (id) => this.allStages().find((s) => s.id === id)?.name ?? null,
      (id) => this.members()?.find((m) => m.id === id)?.displayName ?? null,
    ),
  );

  protected readonly isSuspended = computed(() => this.automation().suspendedAt !== null);

  protected openEdit(): void {
    this.editing.set(true);
  }

  protected cancelEdit(): void {
    this.editing.set(false);
  }

  protected onSave(event: AutomationSaveEvent): void {
    // Forwarded whole, `plainSecret` included: `AutomationsPanel` is what actually calls
    // the store and knows whether the write succeeded, which is what the "shown once"
    // secret reveal has to wait for — showing it before the save is confirmed would show
    // a secret for a rule that might not exist.
    this.saved.emit(event);
    this.editing.set(false);
  }

  protected onToggle(checked: boolean): void {
    this.toggled.emit(checked);
  }

  protected openDeleteConfirm(): void {
    this.deleteConfirm.set(true);
  }

  protected cancelDelete(): void {
    this.deleteConfirm.set(false);
  }

  protected confirmDelete(): void {
    this.deleted.emit();
    this.deleteConfirm.set(false);
  }
}
