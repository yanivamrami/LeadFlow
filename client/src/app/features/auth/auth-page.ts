import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { APP_NAME, APP_SUB } from '../../core/copy';
import { OfflineBanner } from '../../shared/offline-banner';

/**
 * The signed-out screen: one bill, posted.
 *
 * There is no shell out here, and the answer is not to invent a substitute chrome but to
 * use the world's own organs. The ink block at the top is the same ink block the masthead
 * is cut from, at the same height, so signing in reads as one continuous sheet of paper
 * rather than two products handing off. Below it the poster stock runs to the screen
 * edge, the fields stack as a ruled register, and the commit sits at the bottom where the
 * thumb already is.
 *
 * On a wide screen the bill stops stretching and gets a border: a sheet on a wall, not a
 * dialog floating in a viewport.
 */
@Component({
  selector: 'lf-auth-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OfflineBanner],
  template: `
    <div class="bill">
      <header class="head">
        <p class="brand">{{ appName }}<i>{{ appSub }}</i></p>
      </header>

      <lf-offline-banner />

      <div class="body">
        <h1 class="title">{{ title() }}</h1>
        @if (intro(); as text) {
          <p class="intro">{{ text }}</p>
        }

        <!-- novalidate: the browser's own bubbles are English, and this product's
             error copy is part of the design. -->
        <form class="form" novalidate (submit)="commit($event)">
          <ng-content />
        </form>

        <ng-content select="[foot]" />
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-block-size: 100vh;
      min-block-size: 100dvh;
    }

    .bill {
      display: flex;
      flex-direction: column;
      min-block-size: 100vh;
      min-block-size: 100dvh;
    }

    /* the masthead's own block, at the masthead's own height */
    .head {
      display: flex;
      align-items: center;
      min-block-size: 60px;
      padding-inline: var(--lf-space-4);
      background: var(--lf-ink);
      color: var(--lf-on-ink);
    }

    .brand {
      margin: 0;
      direction: ltr;
      font-weight: 600;
      font-size: 26px;
      line-height: 1;
      letter-spacing: -0.01em;
    }
    .brand i {
      font-style: normal;
      font-family: var(--lf-font-num);
      font-weight: 800;
      font-size: 10px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      opacity: 0.72;
      margin-inline-start: 8px;
    }

    .body {
      /* full-bleed children (the commit band, the yellow field) read this */
      --lf-bleed: calc(var(--lf-space-4) * -1);

      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      padding: var(--lf-space-6) var(--lf-space-4) 0;
    }

    .title {
      margin: 0;
      font-family: var(--lf-font-ui);
      font-weight: 600;
      font-size: var(--lf-size-name);
      line-height: 1.05;
    }

    .intro {
      margin: var(--lf-space-3) 0 0;
      max-inline-size: 46ch;
      color: var(--lf-muted);
      line-height: 1.5;
      text-wrap: pretty;
    }

    .title + .form,
    .intro + .form {
      margin-block-start: var(--lf-space-6);
    }

    /* the column the commit band pushes itself to the bottom of */
    .form {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-inline-size: 0;
    }

    @media (min-width: 900px) {
      :host {
        display: grid;
        justify-items: center;
        align-content: start;
      }

      .bill {
        inline-size: 460px;
        min-block-size: auto;
        margin-block: var(--lf-space-12);
        border: 3px solid var(--lf-ink);
        background: var(--lf-ground);
      }

      .head {
        min-block-size: 68px;
        padding-inline: var(--lf-space-6);
      }
      .brand { font-size: 30px; }

      .body {
        --lf-bleed: calc(var(--lf-space-6) * -1);
        padding: var(--lf-space-6) var(--lf-space-6) 0;
      }

      .title { font-size: var(--lf-size-display); }
    }
  `,
})
export class AuthPage {
  protected readonly appName = APP_NAME;
  protected readonly appSub = APP_SUB;

  readonly title = input.required<string>();
  readonly intro = input<string | null>(null);

  /** The page owns the `<form>` so every screen inherits its layout and its submit path. */
  readonly submitted = output<void>();

  /**
   * The native `submit` event, not `ngSubmit`: nothing here uses `ngModel`, so there is no
   * `FormsModule` in this component's imports and therefore no `NgForm` on the form. Bound
   * as `(ngSubmit)` this was a listener for a DOM event that never fires, so the browser
   * navigated and the screen appeared to reload. Cancelling the default is ours to do now.
   */
  protected commit(event: Event): void {
    event.preventDefault();
    this.submitted.emit();
  }
}
