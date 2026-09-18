import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

import { COPY, formatBytes } from '../../core/copy';
import { FILE_ACCEPT, LeadFile } from '../../core/lead-files.store';

/**
 * The files block on the lead sheet.
 *
 * Its own component rather than more markup in lead-sheet.html for two reasons. It is a
 * self-contained thing — a list, a picker and a delete — with no dependency on the rest of the
 * sheet's state; and lead-sheet.scss is already 11.9kB against a 12kB error budget, so the sheet
 * had no room left to describe it. A component that pays for its own stylesheet is the honest
 * answer to that, rather than shaving another rule off the sheet to make space.
 *
 * Presentation only. Every piece of state lives on the sheet, because the sheet's save() needs
 * the pending list and its dirty check needs to know something is waiting — a copy in here would
 * be a second source of truth for the one thing that must not be lost.
 */
@Component({
  selector: 'lf-lead-files',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="files" aria-labelledby="files-title">
      <div class="hd">
        <h3 class="t" id="files-title">{{ copy.title }}</h3>
      </div>

      <!-- The label makes the entire drop area a native file-picker trigger, including for
           keyboard users. Dragging feeds the very same output as choosing from the picker. -->
      <label
        class="drop"
        [class.drop--over]="dragging()"
        [class.drop--off]="disabled() || busy()"
        [attr.aria-disabled]="disabled() || busy()"
        (dragenter)="onDragEnter($event)"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (drop)="onDrop($event)"
      >
        <span class="drop__mark" aria-hidden="true">+</span>
        <span class="drop__text">
          {{ busy() ? copy.adding : dragging() ? copy.dropActive : copy.drop }}
        </span>
        <input
          type="file"
          class="lf-sr"
          multiple
          [accept]="accept"
          [disabled]="disabled() || busy()"
          (change)="onPick($event)"
        />
      </label>

      @if (files().length) {
        <h4 class="list-title" id="uploaded-files-title">{{ copy.uploadedTitle }}</h4>
        <ul class="l" aria-labelledby="uploaded-files-title">
          @for (file of files(); track file.id) {
            <li class="f">
              <button
                type="button"
                class="open"
                [disabled]="busy()"
                [attr.aria-label]="copy.open + ': ' + file.name"
                (click)="openRequested.emit(file)"
              >
                <span class="name">{{ file.name }}</span>
                <span class="size lf-num">{{ size(file.sizeBytes) }}</span>
              </button>
              <button
                type="button"
                class="x"
                [disabled]="busy()"
                [attr.aria-label]="copy.remove + ': ' + file.name"
                (click)="removeRequested.emit(file)"
              >
                {{ copy.remove }}
              </button>
            </li>
          }
        </ul>
      }

      @if (pending().length) {
        <h4 class="list-title" id="pending-files-title">{{ copy.pendingTitle }}</h4>
        <ul class="l" aria-labelledby="pending-files-title">
          <!-- Chosen on a new lead, not yet uploaded: shown in the same list so the user sees
               one set of files rather than having to reconcile two. -->
          @for (held of pending(); track held.name + held.size; let i = $index) {
            <li class="f f--held">
              <span class="open">
                <span class="name">{{ held.name }}</span>
                <span class="size lf-num">{{ size(held.size) }}</span>
              </span>
              <button
                type="button"
                class="x"
                [attr.aria-label]="copy.remove + ': ' + held.name"
                (click)="pendingDropped.emit(i)"
              >
                {{ copy.remove }}
              </button>
            </li>
          }
        </ul>
        <p class="hint">{{ copy.queued(pending().length) }}</p>
      }

      @if (!files().length && !pending().length) {
        <p class="hint">{{ copy.none }}</p>
      }

      <p class="hint">{{ copy.hint }}</p>
    </section>
  `,
  styles: `
    :host { display: block; }

    .files {
      margin-block-start: var(--lf-space-4);
      border-block-start: 3px solid var(--lf-ink);
    }

    .hd {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--lf-space-3);
      padding-block: var(--lf-space-3) var(--lf-space-2);
    }
    .t {
      margin: 0;
      font-weight: 600;
      font-size: var(--lf-size-h2);
      line-height: 1.1;
    }

    /* One generous target for both direct manipulation and the native picker. The dashed rule
       reads as an available placement area in the existing paper-and-ink visual language. */
    .drop {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--lf-space-2);
      min-block-size: 112px;
      padding: var(--lf-space-4);
      border: 3px dashed var(--lf-muted);
      background: color-mix(in srgb, var(--lf-surface) 62%, transparent);
      color: var(--lf-ink);
      text-align: center;
      cursor: pointer;
      transition:
        background var(--lf-dur-state) linear,
        border-color var(--lf-dur-state) linear;
    }
    .drop:hover:not(.drop--off),
    .drop--over {
      border-color: var(--lf-red);
      background: color-mix(in srgb, var(--lf-day) 22%, var(--lf-surface));
    }
    .drop:has(input:focus-visible) { outline: 3px solid var(--lf-red); outline-offset: 2px; }
    .drop--off { opacity: 0.6; cursor: default; }
    .drop__mark {
      display: grid;
      place-items: center;
      inline-size: var(--lf-touch);
      block-size: var(--lf-touch);
      border: 2px solid currentColor;
      font-family: var(--lf-font-num);
      font-size: 30px;
      font-weight: 800;
      line-height: 1;
    }
    .drop__text {
      font-size: var(--lf-size-body);
      font-weight: 600;
      line-height: 1.35;
    }

    .l {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .list-title {
      margin: var(--lf-space-4) 0 var(--lf-space-1);
      font-size: var(--lf-size-small);
      font-weight: 600;
      line-height: 1.4;
      color: var(--lf-muted);
    }

    .f {
      display: flex;
      align-items: center;
      gap: var(--lf-space-2);
      border-block-start: 1px solid var(--lf-rule-soft);
    }
    /* Hatched, the way this world marks anything provisional — the file is chosen but the lead
       it belongs to does not exist yet. */
    .f--held {
      background: repeating-linear-gradient(
        135deg, transparent 0 5px, var(--lf-rule-soft) 5px 6px);
    }

    /* The whole row opens the file. A filename is the thing a user aims at, not a small icon
       beside it. */
    .open {
      flex: 1 1 auto;
      min-inline-size: 0;
      display: flex;
      align-items: baseline;
      gap: var(--lf-space-2);
      min-block-size: var(--lf-touch);
      padding-block: var(--lf-space-1);
      padding-inline: 0;
      border: 0;
      background: transparent;
      color: var(--lf-ink);
      font: inherit;
      text-align: start;
      cursor: pointer;
    }
    .f--held .open { cursor: default; }
    .open:disabled { opacity: 0.6; cursor: default; }
    .open:focus-visible { outline: 3px solid var(--lf-red); outline-offset: 2px; }

    .name {
      flex: 1 1 auto;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--lf-size-body);
    }
    button.open .name { border-block-end: 1px solid var(--lf-rule-soft); }
    button.open:hover .name { border-block-end-color: var(--lf-ink); }

    .size {
      flex: 0 0 auto;
      font-size: 12px;
      color: var(--lf-muted);
    }

    .x {
      flex: 0 0 auto;
      min-block-size: var(--lf-touch);
      padding-inline: var(--lf-space-2);
      border: 2px solid transparent;
      background: transparent;
      color: var(--lf-muted);
      font: inherit;
      font-size: 13px;
      cursor: pointer;
    }
    .x:hover:not(:disabled) {
      color: var(--lf-red-text, var(--lf-red));
      border-color: var(--lf-red-text, var(--lf-red));
    }
    .x:disabled { opacity: 0.6; cursor: default; }

    .hint {
      margin: var(--lf-space-2) 0 0;
      font-size: 13px;
      line-height: 1.45;
      color: var(--lf-muted);
    }
  `,
})
export class LeadFiles {
  protected readonly copy = COPY.lead.files;
  protected readonly accept = FILE_ACCEPT;
  protected readonly size = formatBytes;

  readonly files = input<readonly LeadFile[]>([]);
  /** Chosen but not yet uploaded — create mode only. */
  readonly pending = input<readonly File[]>([]);
  readonly busy = input(false);
  readonly disabled = input(false);

  /**
   * Raw, unvalidated. The sheet validates and reports, because it owns the notify surface and
   * because a rejected file has to be named in the same breath as the ones that were accepted.
   */
  readonly picked = output<File[]>();
  readonly openRequested = output<LeadFile>();
  readonly removeRequested = output<LeadFile>();
  readonly pendingDropped = output<number>();

  protected readonly dragging = signal(false);
  private dragDepth = 0;

  protected onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const chosen = Array.from(input.files ?? []);
    // Cleared either way: leaving the selection in place means choosing the same file again
    // fires no `change` event, so a failed upload could never be retried.
    input.value = '';
    if (chosen.length) this.picked.emit(chosen);
  }

  protected onDragEnter(event: DragEvent): void {
    event.preventDefault();
    if (this.disabled() || this.busy()) return;
    this.dragDepth++;
    this.dragging.set(true);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    if (this.dragDepth > 0) this.dragDepth--;
    if (this.dragDepth === 0) this.dragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragDepth = 0;
    this.dragging.set(false);
    if (this.disabled() || this.busy()) return;

    const chosen = Array.from(event.dataTransfer?.files ?? []);
    if (chosen.length) this.picked.emit(chosen);
  }
}
