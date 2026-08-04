import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

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

        <!-- A label wrapping a visually-hidden input: the OS picker, with none of the browser's
             own button, which cannot be styled into this world. The label is the hit area. -->
        <label class="add" [class.add--off]="disabled() || busy()">
          <span>{{ busy() ? copy.adding : copy.add }}</span>
          <input
            type="file"
            class="lf-sr"
            multiple
            [accept]="accept"
            [disabled]="disabled() || busy()"
            (change)="onPick($event)"
          />
        </label>
      </div>

      @if (files().length || pending().length) {
        <ul class="l">
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

        @if (pending().length) {
          <p class="hint">{{ copy.queued(pending().length) }}</p>
        }
      } @else {
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

    /* The label is the control, so it carries the touch target and the focus ring the hidden
       input would otherwise take with it off screen. */
    .add {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      min-block-size: var(--lf-touch);
      padding-inline: var(--lf-space-3);
      border: 2px solid var(--lf-ink);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background var(--lf-dur-state) linear, color var(--lf-dur-state) linear;
    }
    .add:hover { background: var(--lf-ink); color: var(--lf-on-ink); }
    .add:has(input:focus-visible) { outline: 3px solid var(--lf-red); outline-offset: 2px; }
    .add--off { opacity: 0.6; cursor: default; }
    .add--off:hover { background: transparent; color: var(--lf-ink); }

    .l {
      margin: 0;
      padding: 0;
      list-style: none;
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

  protected onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const chosen = Array.from(input.files ?? []);
    // Cleared either way: leaving the selection in place means choosing the same file again
    // fires no `change` event, so a failed upload could never be retried.
    input.value = '';
    if (chosen.length) this.picked.emit(chosen);
  }
}
