import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';

import { LucideEllipsisVertical } from '@lucide/angular';

import { COPY, STATUS_LABEL } from '../core/copy';
import { Lead, LeadStatus, STAGE_ORDER } from '../core/lead.model';
import { DuePicker } from './due-picker';

/**
 * The per-row actions menu. This is the full non-drag path to a stage change
 * (WCAG 2.1 AA): everything the board's drag does is reachable here, by keyboard,
 * at every breakpoint.
 *
 * It renders through the CDK overlay rather than as an absolutely positioned child.
 * The trigger sits at the row's inline-end edge with ~50px of room beside it, so a
 * statically anchored panel either lands off-screen or under the rows that follow it.
 * The overlay resolves RTL, viewport flipping and stacking in one place.
 */
@Component({
  selector: 'lf-lead-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideEllipsisVertical, CdkOverlayOrigin, CdkConnectedOverlay, DuePicker],
  template: `
    <button
      #trigger
      type="button"
      class="trigger lf-hit"
      cdkOverlayOrigin
      #origin="cdkOverlayOrigin"
      [attr.aria-expanded]="open()"
      [attr.aria-label]="triggerLabel()"
      aria-haspopup="menu"
      (click)="toggle()"
    >
      <svg lucideEllipsisVertical aria-hidden="true"></svg>
    </button>

    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayPositions]="positions"
      [cdkConnectedOverlayViewportMargin]="8"
      [cdkConnectedOverlayPush]="true"
      (overlayOutsideClick)="close()"
      (detach)="close()"
    >
      <div
        class="menu"
        [class.menu--snooze]="page() === 'snooze'"
        [attr.role]="page() === 'menu' ? 'menu' : null"
        [attr.aria-label]="triggerLabel()"
        (keydown.escape)="onEscape()"
      >
        @switch (page()) {
          @case ('menu') {
            <p class="menu__head lf-label">{{ copy.menu.moveTo }}</p>
            @for (status of stages; track status) {
              <button
                type="button"
                role="menuitem"
                class="menu__item"
                [disabled]="status === lead().status"
                (click)="pick(status)"
              >
                {{ statusLabel[status] }}
                @if (status === lead().status) {
                  <span class="menu__now">נוכחי</span>
                }
              </button>
            }
            <div class="menu__rule"></div>
            <button type="button" role="menuitem" class="menu__item" (click)="emitLog()">
              {{ copy.menu.logActivity }}
            </button>
            <button type="button" role="menuitem" class="menu__item" (click)="openSnooze()">
              {{ copy.menu.snooze }}
            </button>
            @if (lead().isDemo) {
              <button
                type="button"
                role="menuitem"
                class="menu__item menu__item--danger"
                (click)="emitDelete()"
              >
                {{ copy.menu.delete }}
              </button>
            }
          }
          @case ('snooze') {
            <!-- the same panel changing job, not a second overlay stacked on the first -->
            <div class="menu__snooze">
              <p class="menu__head lf-label">{{ copy.menu.snooze }}</p>
              <lf-due-picker (picked)="pickSnooze($event)" (cancel)="backToMenu()" />
            </div>
          }
        }
      </div>
    </ng-template>
  `,
  styles: `
    :host { display: inline-flex; flex: 0 0 auto; }

    .trigger {
      display: grid;
      place-items: center;
      background: transparent;
      border: 2px solid transparent;
      color: var(--lf-muted);
      cursor: pointer;
      padding: 0;
    }
    .trigger:hover { color: var(--lf-ink); border-color: var(--lf-ink); }
    .trigger svg { inline-size: 20px; block-size: 20px; stroke-width: 2.4; }

    /* lives in the overlay container, so it carries no positioning of its own */
    .menu {
      inline-size: max-content;
      min-inline-size: 208px;
      max-inline-size: calc(100vw - 24px);
      background: var(--lf-ground);
      border: 3px solid var(--lf-ink);
      padding-block: 6px;
    }
    /* the date field and its three chips need more room than a stage list does */
    .menu--snooze { inline-size: 288px; max-inline-size: calc(100vw - 24px); }

    .menu__snooze { padding: 4px 14px 12px; }

    .menu__head {
      margin: 0;
      padding: 8px 14px 6px;
      color: var(--lf-muted);
    }

    .menu__item {
      display: flex;
      align-items: center;
      gap: 8px;
      inline-size: 100%;
      min-block-size: 44px;
      padding-inline: 14px;
      background: transparent;
      border: 0;
      font: inherit;
      color: var(--lf-ink);
      text-align: start;
      cursor: pointer;
    }
    .menu__item:hover:not(:disabled) { background: var(--lf-day); color: var(--lf-on-day); }
    .menu__item:disabled { color: var(--lf-muted); cursor: default; }
    .menu__item--danger { color: var(--lf-red); }
    .menu__now { margin-inline-start: auto; font-size: 12px; color: var(--lf-muted); }

    .menu__rule {
      block-size: 2px;
      background: var(--lf-ink);
      margin: 6px 0;
    }
  `,
})
export class LeadMenu {
  readonly lead = input.required<Lead>();

  readonly moveTo = output<LeadStatus>();
  readonly logActivity = output<void>();
  /** Emits the day the user picked — the store, not this menu, decides what "today" means. */
  readonly snooze = output<Date>();
  readonly deleteLead = output<void>();

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  protected readonly open = signal(false);
  /** The overlay's second "page": the stage list, or the day picker in its place. */
  protected readonly page = signal<'menu' | 'snooze'>('menu');
  protected readonly copy = COPY;
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly stages = STAGE_ORDER;
  protected readonly triggerLabel = computed(() => `${COPY.shell.openMenu} — ${this.lead().name}`);

  /**
   * Open below the trigger, flipping above it near the viewport floor. Under RTL the CDK
   * reads `start` as the right edge, so `start`/`start` is what keeps the panel growing
   * back into the page instead of off the inline-end edge where the trigger lives.
   */
  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
  ];

  protected toggle(): void {
    const next = !this.open();
    this.open.set(next);
    if (next) this.page.set('menu');
  }

  protected close(): void {
    this.open.set(false);
    this.page.set('menu');
  }

  protected closeAndFocus(): void {
    this.close();
    this.trigger().nativeElement.focus();
  }

  /**
   * Escape steps back one page at a time: out of the picker into the menu it replaced,
   * then out of the menu entirely — never both in one keystroke.
   */
  protected onEscape(): void {
    if (this.page() === 'snooze') {
      this.backToMenu();
    } else {
      this.closeAndFocus();
    }
  }

  protected pick(status: LeadStatus): void {
    this.moveTo.emit(status);
    this.closeAndFocus();
  }

  protected emitLog(): void {
    this.logActivity.emit();
    this.closeAndFocus();
  }

  protected openSnooze(): void {
    this.page.set('snooze');
  }

  protected backToMenu(): void {
    this.page.set('menu');
  }

  protected pickSnooze(due: Date): void {
    this.snooze.emit(due);
    this.closeAndFocus();
  }

  protected emitDelete(): void {
    this.deleteLead.emit();
    this.closeAndFocus();
  }
}
