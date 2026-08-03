import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

import { LucidePlus } from '@lucide/angular';

import { COPY } from '../../core/copy';
import { SwatchName } from '../../core/lead.model';
import { NewStageInput } from '../../core/stages.store';
import { TextField } from '../../shared/text-field';
import { COPY_STAGES, STAGE_TEMPLATES } from './stages.copy';

const SWATCHES: readonly SwatchName[] = [
  'chalk',
  'sky',
  'moss',
  'amber',
  'plum',
  'clay',
  'slate',
  'sand',
];

/**
 * "הוסף שלב" — a template picker, not a blank form (documents/PLAN-stages.md §4.4). A
 * stage the user invents has no teaching copy, and this product's whole positioning is
 * guided-for-beginners, so every filled template arrives with `meaning`, `guidance`, a
 * sensible `driftDays` and `expectsReply` already set. Only "שלב משלי" leaves the copy
 * empty, and even then only the name is required — the rest stays optional here too.
 *
 * Presentational: emits the finished `NewStageInput` and lets `Stages` call the store, the
 * same split `StageRow` uses.
 */
@Component({
  selector: 'lf-add-stage',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucidePlus, TextField],
  templateUrl: './add-stage.html',
  styleUrl: './add-stage.scss',
})
export class AddStage {
  protected readonly copy = COPY;
  protected readonly copyStages = COPY_STAGES;
  protected readonly templates = STAGE_TEMPLATES;
  protected readonly swatches = SWATCHES;

  readonly busy = input(false);
  readonly create = output<NewStageInput>();

  protected readonly open = signal(false);
  protected readonly customOpen = signal(false);
  protected readonly customSwatch = signal<SwatchName>('chalk');
  protected readonly nameTried = signal(false);

  protected toggleOpen(): void {
    this.open.update((v) => !v);
    if (!this.open()) this.customOpen.set(false);
  }

  protected toggleCustom(): void {
    this.customOpen.update((v) => !v);
    this.nameTried.set(false);
  }

  protected pickTemplate(template: NewStageInput): void {
    this.create.emit(template);
    this.open.set(false);
    this.customOpen.set(false);
  }

  protected submitCustom(
    nameField: TextField,
    meaningEl: HTMLTextAreaElement,
    guidanceEl: HTMLTextAreaElement,
    driftField: TextField,
    expectsEl: HTMLInputElement,
  ): void {
    this.nameTried.set(true);
    const name = nameField.value().trim();
    if (!name) return;

    const driftRaw = driftField.value().trim();
    const driftDays = driftRaw ? Number(driftRaw) : null;
    // Silently-invalid drift input just does not commit — same guard as StageRow's.
    if (driftDays !== null && (!Number.isInteger(driftDays) || driftDays < 0)) return;

    this.create.emit({
      name,
      shortName: null,
      swatch: this.customSwatch(),
      meaning: meaningEl.value.trim() || null,
      guidance: guidanceEl.value.trim() || null,
      driftDays,
      expectsReply: expectsEl.checked,
    });

    this.open.set(false);
    this.customOpen.set(false);
    this.customSwatch.set('chalk');
    this.nameTried.set(false);
  }
}
