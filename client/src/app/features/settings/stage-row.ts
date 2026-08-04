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
 *
 * The fields are grouped into four `fieldset`s — identity, timing, teaching copy, archive —
 * because a legend is the one grouping cue that survives being read aloud, and this form is
 * long enough that "which of these belong together" is a real question. Drag reorder is not
 * this component's business any more: the handle lives on the roster strip in `stages.html`,
 * which is the thing that actually moves.
 */
@Component({
  selector: 'lf-stage-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StageTag, TextField, AutomationsPanel],
  templateUrl: './stage-row.html',
  styleUrl: './stage-row.scss',
  host: {
    // Attached: the editor hangs off the strip above it on a phone, so it shares that
    // strip's border instead of drawing a second one across the seam.
    '[class.row--attached]': 'attached()',
    '[class.row--pane]': 'heading()',
  },
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

  /** True in the desktop editor pane, where this component has to name what it is showing.
   *  False on a phone, where the roster strip above it already does. */
  readonly heading = input(false);
  /** True when rendered directly under its own roster strip (phone), which shares a border
   *  with it rather than each drawing their own. */
  readonly attached = input(false);

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

  /**
   * The swatch group's label names the chosen colour: the squares themselves carry only
   * hue plus an `aria-label`, so without this the current value would be visible and
   * nowhere readable. Resolved per swatch change rather than per pass, like the sentences
   * below it.
   */
  protected readonly swatchCurrentLabel = computed(() =>
    this.copyStages.swatchCurrent(this.copyStages.swatchName[this.stage().swatch]),
  );

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

  /** The count line under the fields: "still counting" or the formatted number — one
   *  sentence, decided once per count change rather than rebuilt every pass. */
  protected readonly leadCountLabel = computed(() => {
    const count = this.leadCount();
    return count === null ? this.copyStages.leadCountUnknown : this.copyStages.leadCount(count);
  });

  /**
   * The two archive-dialog sentences that depend on the count. Both are only ever shown
   * once `leadCount()` is resolved — the empty-string branch below is never actually
   * reached given the template's own guards (`leadCount() === null` short-circuits first)
   * — but a computed is exactly the place to spell out what "no count yet" means instead
   * of carrying a `leadCount()!` assertion into the call, which is what this replaces.
   */
  protected readonly archiveNeedsDestinationNote = computed(() => {
    const count = this.leadCount();
    return count === null ? '' : this.copy.stages.archiveNeedsDestination(count);
  });

  protected readonly willMoveNote = computed(() => {
    const count = this.leadCount();
    return count === null ? '' : this.copyStages.willMove(count, this.destinationName());
  });

  /** Same reasoning as `dragHandleLabel`: a copy sentence built from the stage name. */
  protected readonly archiveConfirmNote = computed(() => this.copyStages.archiveConfirm(this.stage().name));

  protected readonly archiveOpen = signal(false);
  protected readonly destinationId = signal<string | null>(null);

  /** The chosen destination's name, resolved once per pick instead of an array `.find()`
   *  re-run on every change-detection pass while the archive dialog is open. */
  protected readonly destinationName = computed<string>(() => {
    const id = this.destinationId();
    if (!id) return '';
    return this.allStages().find((s) => s.id === id)?.name ?? '';
  });

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
}
