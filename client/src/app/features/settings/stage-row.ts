import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CdkDragHandle } from '@angular/cdk/drag-drop';

import { LucideGripVertical } from '@lucide/angular';

import { COPY } from '../../core/copy';
import { Stage, SwatchName } from '../../core/lead.model';
import { ArchiveVerdict, archiveCheck } from '../../core/stages.rules';
import { StagePatch } from '../../core/stages.store';
import { StageTag } from '../../shared/stage-tag';
import { TextField } from '../../shared/text-field';
import { AutomationsPanel } from './automations-panel';
import { COPY_STAGES } from './stages.copy';

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

let seq = 0;

/**
 * One pipeline stage, editable in place. Presentational only: every write goes back up
 * to `Stages`, which owns the `StagesStore` call and its busy/notify plumbing. This
 * component's job is to say *what* changed, and — for archiving — to run the same
 * `archiveCheck` gate the store re-asserts, so the button the user sees already agrees
 * with what a click will do.
 *
 * Text and number fields commit on blur (`focusout`), not per keystroke: `lf-text-field`'s
 * `value` is a `model()`, read straight off the template reference at commit time, so
 * there is no local draft signal that has to be kept in sync with the store's
 * reload-replaces-everything write pattern (see `StagesStore.commit`).
 */
@Component({
  selector: 'lf-stage-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDragHandle, LucideGripVertical, StageTag, TextField, AutomationsPanel],
  templateUrl: './stage-row.html',
  styleUrl: './stage-row.scss',
})
export class StageRow {
  protected readonly copy = COPY;
  protected readonly copyStages = COPY_STAGES;
  protected readonly swatches = SWATCHES;
  protected readonly uid = `stage-row-${++seq}`;

  readonly stage = input.required<Stage>();
  /** `null` = still counting — the template shows that instead of offering to archive. */
  readonly leadCount = input<number | null>(null);
  /** Every stage the tenant has, archived included — what `archiveCheck` needs to know
   *  whether this is the last live open stage, and what the destination picker offers. */
  readonly allStages = input.required<readonly Stage[]>();
  readonly busy = input(false);

  readonly renamed = output<{ name: string; shortName: string | null }>();
  readonly patched = output<StagePatch>();
  /** `destinationId` is null only when the verdict was `'ok'` — nothing to move. */
  readonly archiveRequested = output<string | null>();

  private readonly nameField = viewChild<TextField>('nameField');
  private readonly shortNameField = viewChild<TextField>('shortNameField');
  private readonly driftField = viewChild<TextField>('driftField');
  private readonly meaningField = viewChild<ElementRef<HTMLTextAreaElement>>('meaningField');
  private readonly guidanceField = viewChild<ElementRef<HTMLTextAreaElement>>('guidanceField');

  protected readonly driftDisplay = computed(() => {
    const days = this.stage().driftDays;
    return days === null ? '' : String(days);
  });

  /** Won and lost keep their reserved look (stage-tag.ts) regardless of `swatch`, so
   *  offering the picker there would edit a field with no visible effect. */
  protected readonly swatchLocked = computed(() => this.stage().kind !== 'open');

  protected readonly destinationOptions = computed(() =>
    this.allStages().filter((s) => s.archivedAt === null && s.id !== this.stage().id),
  );

  /** `null` while the count is still loading — archiving is offered nothing until then. */
  protected readonly verdict = computed<ArchiveVerdict | null>(() => {
    const count = this.leadCount();
    if (count === null) return null;
    return archiveCheck(this.stage(), count, this.allStages());
  });

  protected readonly refusedReason = computed<string | null>(() => {
    const v = this.verdict();
    return v !== null && typeof v === 'object' ? v.refused : null;
  });

  protected readonly archiveOpen = signal(false);
  protected readonly destinationId = signal<string | null>(null);

  /** Both name fields share one commit: `rename()` writes them together. */
  protected commitRename(): void {
    const nameField = this.nameField();
    const shortField = this.shortNameField();
    if (!nameField || !shortField) return;

    const stage = this.stage();
    const name = nameField.value().trim();

    // A blank name is not a valid stage name — revert rather than send it.
    if (!name) {
      nameField.value.set(stage.name);
      return;
    }
    const shortName = shortField.value().trim() || null;
    if (name === stage.name && shortName === stage.shortName) return;
    this.renamed.emit({ name, shortName });
  }

  protected commitDrift(): void {
    const field = this.driftField();
    if (!field) return;

    const raw = field.value().trim();
    if (!raw) {
      if (this.stage().driftDays !== null) this.patched.emit({ driftDays: null });
      return;
    }

    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 0) {
      field.value.set(this.driftDisplay()); // reject invalid input by reverting it
      return;
    }
    if (parsed !== this.stage().driftDays) this.patched.emit({ driftDays: parsed });
  }

  protected commitMeaning(): void {
    const el = this.meaningField()?.nativeElement;
    if (!el) return;
    const value = el.value.trim() || null;
    if (value !== this.stage().meaning) this.patched.emit({ meaning: value });
  }

  protected commitGuidance(): void {
    const el = this.guidanceField()?.nativeElement;
    if (!el) return;
    const value = el.value.trim() || null;
    if (value !== this.stage().guidance) this.patched.emit({ guidance: value });
  }

  protected pickSwatch(swatch: SwatchName): void {
    if (this.swatchLocked() || this.busy() || swatch === this.stage().swatch) return;
    this.patched.emit({ swatch });
  }

  protected toggleExpectsReply(checked: boolean): void {
    this.patched.emit({ expectsReply: checked });
  }

  protected openArchive(): void {
    this.destinationId.set(null);
    this.archiveOpen.set(true);
  }

  protected cancelArchive(): void {
    this.archiveOpen.set(false);
    this.destinationId.set(null);
  }

  protected confirmArchive(): void {
    this.archiveRequested.emit(this.destinationId());
    this.archiveOpen.set(false);
  }

  protected destinationName(id: string): string {
    return this.allStages().find((s) => s.id === id)?.name ?? '';
  }
}
