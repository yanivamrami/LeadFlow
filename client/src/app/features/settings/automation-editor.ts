import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import {
  ActionInput,
  Automation,
  AutomationAction,
  AutomationTrigger,
  NewAutomationInput,
  TenantMember,
  TriggerInput,
} from '../../core/automations.store';
import { webhookUrlCheck } from '../../core/automations.rules';
import { Stage } from '../../core/lead.model';
import { FormError } from '../../shared/form-error';
import { TextField } from '../../shared/text-field';
import {
  ACTION_OPTIONS,
  AutomationDescriptor,
  COPY_AUTOMATIONS,
  TRIGGER_OPTIONS,
  describeAutomation,
} from './automations.copy';

/**
 * What the editor hands back on save.
 *
 * No secret here. The editor used to mint one client-side and pass it up, which produced a
 * key the user was shown and the sender could never verify against — the rule saved and every
 * send failed for want of a signing key. `mint_webhook_secret` (20260804091200) now generates
 * it in the database, writes it to Vault, and returns the plaintext once; the panel calls that
 * after the rule exists, because the secret is stored under the rule's own id.
 */
export interface AutomationSaveEvent {
  input: NewAutomationInput;
}

/**
 * SCREENS 9.3 — the rule editor. In-place expansion, never a modal (the pattern 3.6, 3.7,
 * 4.2 and the stage manager itself already set). Order matches the plan exactly: trigger,
 * then action, then that action's own fields, then the full-sentence restatement — the
 * user reads back what they built before the save button is even enabled.
 *
 * Presentational, like `StageRow` and `AddStage`: every write goes back up through `save`,
 * and this component owns only the draft fields and their validity.
 */
@Component({
  selector: 'lf-automation-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TextField, FormError],
  templateUrl: './automation-editor.html',
  styleUrl: './automation-editor.scss',
})
export class AutomationEditor {
  protected readonly copy = COPY_AUTOMATIONS;
  protected readonly triggers = TRIGGER_OPTIONS;
  protected readonly actions = ACTION_OPTIONS;

  readonly stageId = input.required<string>();
  readonly allStages = input.required<readonly Stage[]>();
  readonly members = input<TenantMember[] | null>(null);
  readonly membersFailed = input(false);
  /** Present when editing an existing rule; absent when creating one. */
  readonly initial = input<Automation | null>(null);
  readonly busy = input(false);

  readonly save = output<AutomationSaveEvent>();
  readonly cancel = output<void>();

  protected readonly trigger = signal<AutomationTrigger>('lead_enters_stage');
  protected readonly idleDaysText = signal('3');
  protected readonly action = signal<AutomationAction>('set_reminder');
  protected readonly reminderDays = signal('3');
  protected readonly reminderTitle = signal('');
  protected readonly assignUserId = signal('');
  protected readonly noteBody = signal('');
  protected readonly advanceStageId = signal('');
  protected readonly webhookUrl = signal('');

  constructor() {
    const initial = this.initial();
    if (!initial) return;

    this.trigger.set(initial.trigger);
    this.idleDaysText.set(initial.idleDays !== null ? String(initial.idleDays) : '3');
    this.action.set(initial.action);

    switch (initial.action) {
      case 'set_reminder':
        this.reminderDays.set(String(initial.config.days));
        this.reminderTitle.set(initial.config.title ?? '');
        break;
      case 'assign_member':
        this.assignUserId.set(initial.config.userId);
        break;
      case 'add_note':
        this.noteBody.set(initial.config.body);
        break;
      case 'suggest_advance':
        this.advanceStageId.set(initial.config.stageId);
        break;
      case 'webhook':
        this.webhookUrl.set(initial.config.url);
        break;
    }
  }

  protected readonly otherStages = computed(() =>
    this.allStages().filter((s) => s.archivedAt === null && s.id !== this.stageId()),
  );

  protected readonly webhookVerdict = computed(() => {
    if (this.action() !== 'webhook') return null;
    return webhookUrlCheck(this.webhookUrl());
  });

  protected readonly webhookError = computed(() => {
    const verdict = this.webhookVerdict();
    return verdict !== null && typeof verdict === 'object' ? verdict.refused : null;
  });

  protected readonly sentence = computed(() => {
    const trigger = this.triggerDraft(true);
    const action = this.actionDraft(true);
    const descriptor = { ...trigger, ...action } as AutomationDescriptor;
    return describeAutomation(
      descriptor,
      (id) => this.allStages().find((s) => s.id === id)?.name ?? null,
      (id) => this.members()?.find((m) => m.id === id)?.displayName ?? null,
    );
  });

  protected readonly canSave = computed(() => {
    if (this.triggerDraft(false) === null) return false;
    if (this.actionDraft(false) === null) return false;
    if (this.action() === 'webhook') return this.webhookVerdict() === 'ok';
    return true;
  });

  protected pickTrigger(trigger: AutomationTrigger): void {
    this.trigger.set(trigger);
  }

  protected pickAction(action: AutomationAction): void {
    this.action.set(action);
  }

  protected submit(): void {
    const trigger = this.triggerDraft(false);
    const action = this.actionDraft(false);
    if (!trigger || !action) return;

    if (action.action === 'webhook') {
      if (webhookUrlCheck(action.config.url) !== 'ok') return;

      // The rule is saved with no secret_ref at all when it is new; the panel mints one
      // immediately afterwards and the database fills this field in. Editing an existing
      // webhook carries its current ref through untouched — rotating a key an endpoint is
      // already configured to verify would break every call it makes.
      const existing =
        this.initial()?.action === 'webhook'
          ? (this.initial() as Extract<Automation, { action: 'webhook' }>).config.secretRef
          : '';

      const input = {
        stageId: this.stageId(),
        ...trigger,
        action: 'webhook',
        config: { url: action.config.url, secretRef: existing },
      } as NewAutomationInput;

      this.save.emit({ input });
      return;
    }

    const input = { stageId: this.stageId(), ...trigger, ...action } as NewAutomationInput;
    this.save.emit({ input });
  }

  private triggerDraft(lenient: boolean): TriggerInput | null {
    const trigger = this.trigger();
    if (trigger === 'lead_enters_stage') return { trigger, idleDays: null };

    const n = Number(this.idleDaysText().trim());
    if (Number.isInteger(n) && n > 0) return { trigger, idleDays: n };
    return lenient ? { trigger, idleDays: 1 } : null;
  }

  private actionDraft(lenient: boolean): ActionInput | null {
    const action = this.action();

    switch (action) {
      case 'set_reminder': {
        const n = Number(this.reminderDays().trim());
        const title = this.reminderTitle().trim() || null;
        if (Number.isInteger(n) && n > 0) return { action, config: { days: n, title } };
        return lenient ? { action, config: { days: 1, title } } : null;
      }
      case 'assign_member': {
        const userId = this.assignUserId();
        if (userId) return { action, config: { userId } };
        if (!lenient) return null;
        return { action, config: { userId: this.members()?.[0]?.id ?? '' } };
      }
      case 'add_note': {
        const body = this.noteBody().trim();
        if (body) return { action, config: { body } };
        return lenient ? { action, config: { body: '…' } } : null;
      }
      case 'suggest_advance': {
        const stageId = this.advanceStageId();
        if (stageId) return { action, config: { stageId } };
        if (!lenient) return null;
        return { action, config: { stageId: this.otherStages()[0]?.id ?? '' } };
      }
      case 'webhook': {
        const url = this.webhookUrl().trim();
        if (url) return { action, config: { url, secretRef: '' } };
        return lenient ? { action, config: { url: 'https://…', secretRef: '' } } : null;
      }
    }
  }
}
