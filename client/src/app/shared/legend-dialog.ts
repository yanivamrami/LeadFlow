import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';

import { LucideX } from '@lucide/angular';

import { COPY, STATUS_GUIDANCE, STATUS_MEANING, STATUS_LABEL } from '../core/copy';
import { STAGE_ORDER } from '../core/lead.model';
import { HelpService } from '../core/help.service';
import { StageTag } from './stage-tag';

/**
 * The legend — the answer to "what does any of this mean?".
 *
 * The PRD's audience has never managed leads before, so nothing on screen can assume
 * the vocabulary. Colour, texture and every term of art are explained here in plain
 * words, with the real swatch beside each one rather than a description of it: a
 * legend that describes a colour instead of showing it asks the reader to do the
 * matching, which is the work it exists to remove.
 */
@Component({
  selector: 'lf-legend-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [A11yModule, LucideX, StageTag],
  template: `
    @if (open()) {
      <div class="scrim" (click)="close()"></div>

      <section
        class="panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="legend-title"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
        (keydown.escape)="close()"
      >
        <header class="hd">
          <div class="hd__text">
            <h2 class="hd__title" id="legend-title">{{ copy.help.title }}</h2>
            <p class="hd__sub">{{ copy.help.subtitle }}</p>
          </div>
          <button type="button" class="hd__x lf-hit" [attr.aria-label]="copy.help.close" (click)="close()">
            <svg lucideX aria-hidden="true"></svg>
          </button>
        </header>

        <div class="body">
          <!-- the day sheet -->
          <section class="sec">
            <h3 class="sec__title">{{ copy.help.sheetTitle }}</h3>
            <div class="demo demo--day" aria-hidden="true">היום</div>
            <p class="sec__body">{{ copy.help.sheetBody }}</p>
          </section>

          <!-- the row flags -->
          <section class="sec">
            <h3 class="sec__title">{{ copy.help.flagsTitle }}</h3>
            <ul class="rows">
              <li class="row">
                <span class="flag flag--now" aria-hidden="true"></span>
                <span>{{ copy.help.flagNow }}</span>
              </li>
              <li class="row">
                <span class="flag flag--drift" aria-hidden="true"></span>
                <span>{{ copy.help.flagDrift }}</span>
              </li>
              <li class="row">
                <span class="flag flag--none" aria-hidden="true"></span>
                <span>{{ copy.help.flagNone }}</span>
              </li>
            </ul>
          </section>

          <!-- board cards -->
          <section class="sec">
            <h3 class="sec__title">{{ copy.help.cardsTitle }}</h3>
            <ul class="rows">
              <li class="row">
                <span class="mini mini--now" aria-hidden="true"></span>
                <span>{{ copy.help.cardNow }}</span>
              </li>
              <li class="row">
                <span class="mini mini--drift" aria-hidden="true"></span>
                <span>{{ copy.help.cardDrift }}</span>
              </li>
              <li class="row">
                <span class="mini mini--won" aria-hidden="true"></span>
                <span>{{ copy.help.cardWon }}</span>
              </li>
              <li class="row">
                <span class="mini mini--lost" aria-hidden="true"></span>
                <span>{{ copy.help.cardLost }}</span>
              </li>
            </ul>
          </section>

          <!-- the six stages: what it is, then what to do -->
          <section class="sec">
            <h3 class="sec__title">{{ copy.help.stagesTitle }}</h3>
            <p class="sec__body">{{ copy.help.stagesLead }}</p>
            <ul class="stages">
              @for (stage of stages; track stage) {
                <li class="stage">
                  <lf-stage-tag [status]="stage" />
                  <p class="stage__what">{{ meaning[stage] }}</p>
                  <p class="stage__next">{{ guidance[stage] }}</p>
                </li>
              }
            </ul>
          </section>

          <!-- colours -->
          <section class="sec">
            <h3 class="sec__title">{{ copy.help.colorsTitle }}</h3>
            <ul class="rows">
              <li class="row">
                <span class="chip chip--day" aria-hidden="true"></span>
                <span>{{ copy.help.colorDay }}</span>
              </li>
              <li class="row">
                <span class="chip chip--red" aria-hidden="true"></span>
                <span>{{ copy.help.colorRed }}</span>
              </li>
              <li class="row">
                <span class="chip chip--ink" aria-hidden="true"></span>
                <span>{{ copy.help.colorInk }}</span>
              </li>
              <li class="row">
                <span class="chip chip--hatch" aria-hidden="true"></span>
                <span>{{ copy.help.colorHatch }}</span>
              </li>
            </ul>
          </section>

          <!-- the term of art -->
          <section class="sec">
            <h3 class="sec__title">{{ copy.help.qualifyTitle }}</h3>
            <p class="sec__body">{{ copy.help.qualifyBody }}</p>
            <p class="sec__note">{{ copy.help.qualifyNote }}</p>
          </section>
        </div>

        <footer class="ft">
          <button type="button" class="done" (click)="close()">{{ copy.help.close }}</button>
        </footer>
      </section>
    }
  `,
  styles: `
    :host { display: contents; }

    .scrim {
      position: fixed;
      inset: 0;
      z-index: 74;
      background: color-mix(in srgb, var(--lf-fixed-ink) 82%, transparent);
    }

    .panel {
      position: fixed;
      z-index: 75;
      inset-inline: 0;
      inset-block-end: 0;
      max-block-size: 92vh;
      display: flex;
      flex-direction: column;
      background: var(--lf-ground);
      color: var(--lf-ink);
      border-block-start: 3px solid var(--lf-ink);
    }

    .hd {
      flex: 0 0 auto;
      display: flex;
      align-items: flex-start;
      gap: var(--lf-space-3);
      padding: var(--lf-space-4);
      border-block-end: 3px solid var(--lf-ink);
    }
    .hd__text { flex: 1 1 auto; min-inline-size: 0; }
    .hd__title {
      margin: 0;
      font-weight: 600;
      font-size: var(--lf-size-name);
      line-height: 1.05;
    }
    .hd__sub {
      margin: 6px 0 0;
      font-size: 14px;
      color: var(--lf-muted);
    }
    .hd__x {
      flex: 0 0 auto;
      display: grid;
      place-items: center;
      border: 2px solid transparent;
      background: transparent;
      color: var(--lf-muted);
      cursor: pointer;
    }
    .hd__x:hover { color: var(--lf-ink); border-color: var(--lf-ink); }
    .hd__x svg { inline-size: 20px; block-size: 20px; stroke-width: 2.4; }

    .body {
      flex: 1 1 auto;
      overflow-y: auto;
      padding: 0 var(--lf-space-4) var(--lf-space-6);
    }

    .sec {
      padding-block: var(--lf-space-4);
      border-block-start: 1px solid var(--lf-rule-soft);
    }
    .sec:first-child { border-block-start: 0; }
    .sec__title {
      margin: 0 0 var(--lf-space-3);
      font-weight: 600;
      font-size: var(--lf-size-h2);
      line-height: 1.1;
    }
    .sec__body {
      margin: 0;
      font-size: var(--lf-size-body);
      line-height: 1.55;
    }
    .sec__note {
      margin: var(--lf-space-3) 0 0;
      padding-inline-start: var(--lf-space-3);
      border-inline-start: 2px solid var(--lf-red);
      font-size: 14px;
      line-height: 1.5;
      color: var(--lf-muted);
    }

    /* a real strip of the day sheet, not a description of one */
    .demo--day {
      background: var(--lf-day);
      color: var(--lf-on-day);
      border: 2px solid var(--lf-fixed-ink);
      padding: var(--lf-space-2) var(--lf-space-3);
      margin-block-end: var(--lf-space-3);
      font-weight: 600;
      font-size: 24px;
      line-height: 1;
    }

    .rows {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: var(--lf-space-3);
    }
    .row {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr);
      gap: var(--lf-space-3);
      align-items: center;
      font-size: 14px;
      line-height: 1.45;
    }

    /* the flag, at the size it appears in the register */
    .flag {
      inline-size: 12px;
      block-size: 34px;
      justify-self: center;
    }
    .flag--now {
      background: var(--lf-day);
      border: 2px solid var(--lf-fixed-ink);
    }
    .flag--drift { background: var(--lf-flag-drift); }
    .flag--none { border: 1px dashed var(--lf-rule-soft); }

    .mini {
      inline-size: 34px;
      block-size: 26px;
      border: 2px solid var(--lf-ink);
      background: var(--lf-surface);
    }
    .mini--now { background: var(--lf-day); border-color: var(--lf-fixed-ink); }
    .mini--drift {
      background: repeating-linear-gradient(
        135deg,
        var(--lf-surface) 0 5px,
        color-mix(in srgb, var(--lf-muted) 22%, transparent) 5px 7px
      );
    }
    .mini--won { border-color: var(--lf-red); }
    .mini--lost {
      border-style: dashed;
      border-color: var(--lf-muted);
      background: transparent;
      opacity: 0.75;
    }

    .chip {
      inline-size: 34px;
      block-size: 26px;
      border: 2px solid var(--lf-ink);
    }
    .chip--day { background: var(--lf-day); border-color: var(--lf-fixed-ink); }
    .chip--red { background: var(--lf-red); border-color: var(--lf-red); }
    .chip--ink { background: var(--lf-ink); }
    .chip--hatch { background: var(--lf-flag-drift); }

    .stages {
      margin: var(--lf-space-4) 0 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: var(--lf-space-4);
    }
    .stage {
      display: grid;
      gap: 6px;
      padding-block-end: var(--lf-space-4);
      border-block-end: 1px solid var(--lf-rule-soft);
    }
    .stage:last-child { border-block-end: 0; padding-block-end: 0; }
    .stage lf-stage-tag { justify-self: start; }
    .stage__what {
      margin: 0;
      font-size: var(--lf-size-body);
      line-height: 1.5;
    }
    /* what to do next, marked the way guidance is marked everywhere else */
    .stage__next {
      margin: 0;
      padding-inline-start: var(--lf-space-3);
      border-inline-start: 2px solid var(--lf-red);
      font-size: 14px;
      line-height: 1.5;
      color: var(--lf-muted);
    }

    .ft {
      flex: 0 0 auto;
      padding: var(--lf-space-3) var(--lf-space-4) var(--lf-space-4);
      border-block-start: 3px solid var(--lf-ink);
    }
    .done {
      inline-size: 100%;
      min-block-size: var(--lf-touch);
      border: 0;
      background: var(--lf-red);
      color: var(--lf-on-red);
      font: inherit;
      font-weight: 600;
      font-size: 17px;
      cursor: pointer;
    }

    @media (min-width: 900px) {
      .panel {
        inset-block: 50% auto;
        inset-inline: 50% auto;
        translate: 50% -50%;
        inline-size: min(560px, calc(100vw - 48px));
        max-block-size: min(88vh, 900px);
        border: 3px solid var(--lf-ink);
      }
      .hd,
      .ft,
      .body { padding-inline: var(--lf-space-6); }
    }
  `,
})
export class LegendDialog {
  private readonly help = inject(HelpService);

  protected readonly copy = COPY;
  protected readonly open = this.help.open;
  protected readonly stages = STAGE_ORDER;
  protected readonly meaning = STATUS_MEANING;
  protected readonly guidance = STATUS_GUIDANCE;
  protected readonly statusLabel = STATUS_LABEL;

  protected close(): void {
    this.help.hide();
  }
}
