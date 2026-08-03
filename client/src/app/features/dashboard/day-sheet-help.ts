import { ChangeDetectionStrategy, Component, computed, inject, model } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { RouterLink } from '@angular/router';

import { LucideX } from '@lucide/angular';

import { COPY } from '../../core/copy';
import { StagesStore } from '../../core/stages.store';
import { StageTag } from '../../shared/stage-tag';

/**
 * "Why is this lead on my yellow page?" — the rules behind the day sheet.
 *
 * Its own dialog rather than a section inside the legend (`shared/legend-dialog`): the legend
 * answers "what does any of this mean" for the whole product and is reached from the masthead,
 * while this answers one question asked in one place, and it is asked while looking at the
 * sheet. Burying it in a general help screen is how it stops being read.
 *
 * The thresholds table is read from `StagesStore`, not written into the copy. Every number in
 * it is editable in the stage manager, so a hardcoded table would start lying the first time
 * somebody changed one — which is exactly the class of documentation this product keeps
 * getting wrong.
 */
@Component({
  selector: 'lf-day-sheet-help',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [A11yModule, LucideX, RouterLink, StageTag],
  template: `
    @if (open()) {
      <div class="scrim" (click)="close()"></div>

      <section
        class="panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-help-title"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
        (keydown.escape)="close()"
      >
        <header class="hd">
          <div class="hd__text">
            <h2 class="hd__title" id="sheet-help-title">{{ c.title }}</h2>
            <p class="hd__sub">{{ c.subtitle }}</p>
          </div>
          <button type="button" class="hd__x lf-hit" [attr.aria-label]="c.close" (click)="close()">
            <svg lucideX aria-hidden="true"></svg>
          </button>
        </header>

        <div class="body">
          <!-- The four reasons, in the order core/attention.ts evaluates them. A list in a
               different order from the engine is worse than no list. -->
          <section class="sec">
            <h3 class="sec__title">{{ c.reasonsTitle }}</h3>
            <p class="sec__lead">{{ c.reasonsLead }}</p>
            <ol class="rules">
              <li class="rule"><span class="rule__n lf-num">1</span>{{ c.reason1 }}</li>
              <li class="rule"><span class="rule__n lf-num">2</span>{{ c.reason2 }}</li>
              <li class="rule"><span class="rule__n lf-num">3</span>{{ c.reason3 }}</li>
              <li class="rule"><span class="rule__n lf-num">4</span>{{ c.reason4 }}</li>
            </ol>
          </section>

          <section class="sec">
            <h3 class="sec__title">{{ c.silenceTitle }}</h3>
            <p class="sec__body">{{ c.silenceBody }}</p>
          </section>

          <section class="sec">
            <h3 class="sec__title">{{ c.quietTitle }}</h3>
            <p class="sec__body">{{ c.quietBody }}</p>
            <p class="sec__body">{{ c.capBody }}</p>
          </section>

          <section class="sec">
            <h3 class="sec__title">{{ c.neverTitle }}</h3>
            <ul class="plain">
              <li>{{ c.neverClosed }}</li>
              <li>{{ c.neverDone }}</li>
            </ul>
          </section>

          <!-- Live values, not documentation. -->
          <section class="sec">
            <h3 class="sec__title">{{ c.defaultsTitle }}</h3>
            <p class="sec__lead">{{ c.defaultsLead }}</p>

            @if (stages().length) {
              <table class="tbl">
                <thead>
                  <tr>
                    <th scope="col">{{ stageColLabel }}</th>
                    <th scope="col">{{ c.defaultsQuietCol }}</th>
                    <th scope="col">{{ c.defaultsReplyCol }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (stage of stages(); track stage.id) {
                    <tr>
                      <td><lf-stage-tag [stage]="stage" [short]="true" /></td>
                      <td class="lf-num">
                        {{ stage.driftDays === null ? c.defaultsNone : stage.driftDays }}
                      </td>
                      <td>{{ stage.expectsReply ? c.defaultsYes : c.defaultsNo }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </section>

          <section class="sec">
            <h3 class="sec__title">{{ c.newStageTitle }}</h3>
            <p class="sec__body">{{ c.newStageBody }}</p>
          </section>

          <section class="sec">
            <h3 class="sec__title">{{ c.whereTitle }}</h3>
            <p class="sec__body">{{ c.whereBody }}</p>
            <a class="link" routerLink="/settings/stages" (click)="close()">{{ c.whereAction }}</a>
          </section>
        </div>
      </section>
    }
  `,
  styles: `
    /* Matches shared/legend-dialog: a sheet from the bottom edge on a phone, a centred block
       on desktop. The scrim uses --lf-fixed-ink because it covers the yellow field, which
       does not flip with the theme. */
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
      font-weight: 600;
      font-size: 17px;
      cursor: pointer;
    }

    .body {
      flex: 1 1 auto;
      overflow-y: auto;
      padding: var(--lf-space-4);
    }

    .sec + .sec {
      margin-block-start: var(--lf-space-5);
      padding-block-start: var(--lf-space-4);
      border-block-start: 2px solid var(--lf-rule-soft);
    }
    .sec__title {
      margin: 0 0 6px;
      font-weight: 600;
      font-size: 16px;
    }
    .sec__lead,
    .sec__body {
      margin: 0 0 8px;
      font-size: 14px;
      line-height: 1.5;
    }
    .sec__lead { color: var(--lf-muted); }

    .rules {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .rule {
      display: flex;
      gap: var(--lf-space-3);
      font-size: 14px;
      line-height: 1.5;
      padding-block: 8px;
    }
    .rule + .rule { border-block-start: 2px solid var(--lf-rule-soft); }
    /* The number carries the precedence, so it is a block rather than a bullet. */
    .rule__n {
      flex: 0 0 auto;
      inline-size: 22px;
      block-size: 22px;
      display: grid;
      place-items: center;
      background: var(--lf-ink);
      color: var(--lf-on-ink);
      font-size: 12px;
      font-weight: 600;
    }

    .plain {
      margin: 0;
      padding-inline-start: 1.1em;
      font-size: 14px;
      line-height: 1.5;
    }
    .plain li + li { margin-block-start: 6px; }

    .tbl {
      inline-size: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    .tbl th {
      text-align: start;
      font-weight: 600;
      font-size: 12px;
      letter-spacing: 0.04em;
      color: var(--lf-muted);
      padding-block-end: 6px;
      border-block-end: 2px solid var(--lf-ink);
    }
    .tbl td {
      padding-block: 8px;
      border-block-end: 2px solid var(--lf-rule-soft);
      vertical-align: middle;
    }
    .tbl tr:last-child td { border-block-end: 0; }

    .link {
      display: inline-block;
      margin-block-start: 4px;
      font-weight: 500;
      color: var(--lf-ink);
      text-decoration: none;
      border-block-end: 2px solid var(--lf-ink);
    }
    .link:hover { color: var(--lf-red-text); border-color: var(--lf-red-text); }

    @media (min-width: 900px) {
      .panel {
        /* Logical inset with a positive X translate — correct under RTL, where a physical
           left: 50% would push the panel off-centre. */
        inset-block: 50% auto;
        inset-inline: 50% auto;
        translate: 50% -50%;
        inline-size: min(560px, calc(100vw - 48px));
        max-block-size: min(88vh, 900px);
        border: 3px solid var(--lf-ink);
      }
      .hd,
      .body { padding-inline: var(--lf-space-6); }
    }
  `,
})
export class DaySheetHelp {
  private readonly stagesStore = inject(StagesStore);

  /** Two-way, so the sheet owns the state and this component only closes itself. */
  readonly open = model(false);

  protected readonly c = COPY.sheet.help;
  protected readonly stageColLabel = COPY.lead.fields.status;

  /** Live rows, in pipeline order — including the closed ones, whose empty threshold is the
   *  clearest possible illustration of what "no value" means. */
  protected readonly stages = computed(() => this.stagesStore.active());

  protected close(): void {
    this.open.set(false);
  }
}
