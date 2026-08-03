import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import { Automation, AutomationsStore, TenantMember } from '../../core/automations.store';
import { Stage } from '../../core/lead.model';
import { AutomationEditor, AutomationSaveEvent } from './automation-editor';
import { AutomationRow } from './automation-row';
import { COPY_AUTOMATIONS } from './automations.copy';

/**
 * SCREENS 9.2 — automations on a stage. Lives inside the stage manager as a section per
 * stage, not its own route (documents/PLAN-automations.md §4: "the mental model is 'this
 * stage does this', and splitting it across two screens breaks that"). One instance mounts
 * per stage row (see `stage-row.html`), plus one read-only instance per archived stage
 * (see `stages.html`'s archived list) so a suspended rule stays visible rather than
 * disappearing along with its stage.
 */
@Component({
  selector: 'lf-automations-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AutomationRow, AutomationEditor],
  templateUrl: './automations-panel.html',
  styleUrl: './automations-panel.scss',
})
export class AutomationsPanel {
  private readonly store = inject(AutomationsStore);

  protected readonly copy = COPY_AUTOMATIONS;

  readonly stage = input.required<Stage>();
  readonly allStages = input.required<readonly Stage[]>();
  /** Archived-stage mode — see `AutomationRow.readOnly` for what this turns off. */
  readonly readOnly = input(false);

  protected readonly loading = this.store.loading;
  protected readonly loaded = this.store.loaded;
  protected readonly loadFailed = this.store.loadFailed;
  protected readonly busyId = this.store.busyId;

  protected readonly rules = computed<Automation[]>(() => this.store.byStage(this.stage().id));

  protected readonly addOpen = signal(false);
  protected readonly members = signal<TenantMember[] | null>(null);
  protected readonly membersFailed = signal(false);

  /** The webhook secret reveal — cleared the moment the user acknowledges it, and never
   *  written back into any store or signal that could re-render it later (SCREENS 9.3:
   *  "shown once on creation... it will not be shown again"). */
  protected readonly revealSecret = signal<string | null>(null);

  constructor() {
    void this.store.load();
  }

  protected retry(): void {
    void this.store.reload();
  }

  protected toggleAdd(): void {
    this.addOpen.update((v) => !v);
    if (this.addOpen()) void this.ensureMembers();
  }

  protected async ensureMembers(): Promise<void> {
    if (this.members() !== null) return;
    try {
      this.members.set(await this.store.loadTenantMembers());
    } catch {
      this.membersFailed.set(true);
    }
  }

  protected async onCreate(event: AutomationSaveEvent): Promise<void> {
    const id = await this.store.create(event.input);
    if (!id) return;
    this.addOpen.set(false);

    // The secret is minted by the database, after the rule exists, because it is stored in
    // Vault under the rule's own id and the sender reads it back from there. This is the only
    // moment its plaintext exists outside Vault, so it goes straight to the reveal panel.
    if (event.input.action === 'webhook') {
      const secret = await this.store.mintSecret(id);
      if (secret) this.revealSecret.set(secret);
    }
  }

  protected async onSave(rule: Automation, event: AutomationSaveEvent): Promise<void> {
    const ok = await this.store.update(rule.id, event.input);
    if (!ok) return;

    // Editing a webhook rule deliberately does NOT rotate the key: an endpoint already
    // configured to verify the old one would start rejecting every call. A rule that has no
    // secret yet (created before the minting RPC existed, or a failed first mint) gets one.
    if (rule.action === 'webhook' && !rule.config.secretRef) {
      const secret = await this.store.mintSecret(rule.id);
      if (secret) this.revealSecret.set(secret);
    }
  }

  protected async onToggle(rule: Automation, enabled: boolean): Promise<void> {
    await this.store.setEnabled(rule.id, enabled);
  }

  protected async onDelete(rule: Automation): Promise<void> {
    await this.store.remove(rule.id);
  }

  protected async copySecret(): Promise<void> {
    const secret = this.revealSecret();
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
    } catch {
      // Clipboard access can be denied by the browser; the secret is still selectable text
      // in the panel, so this is a convenience, not the only way to copy it.
    }
  }

  protected dismissSecret(): void {
    this.revealSecret.set(null);
  }
}
