import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Stage } from '../core/lead.model';

/**
 * Pipeline stage as a posted block. `kind` carries the two reserved looks — Won's red
 * fill, Lost's dashed outline — so a stage the user renamed still reads as closed; every
 * other stage renders by its own swatch (theme/tokens.css). Colour never carries the
 * meaning alone — the Hebrew label always ships with it.
 */
@Component({
  selector: 'lf-stage-tag',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="tag" [class]="tagClass()">{{ label() }}</span>`,
  styles: `
    :host { display: inline-flex; min-inline-size: 0; }

    .tag {
      display: inline-block;
      padding: 2px 9px;
      border: 2px solid var(--lf-ink);
      font-weight: 500;
      font-size: 13px;
      line-height: 1.45;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .tag--sw-chalk { background: var(--lf-sw-chalk-bg); color: var(--lf-sw-chalk-fg); }
    .tag--sw-sky { background: var(--lf-sw-sky-bg); color: var(--lf-sw-sky-fg); }
    .tag--sw-moss { background: var(--lf-sw-moss-bg); color: var(--lf-sw-moss-fg); }
    .tag--sw-amber { background: var(--lf-sw-amber-bg); color: var(--lf-sw-amber-fg); }
    .tag--sw-plum { background: var(--lf-sw-plum-bg); color: var(--lf-sw-plum-fg); }
    .tag--sw-clay { background: var(--lf-sw-clay-bg); color: var(--lf-sw-clay-fg); }
    .tag--sw-slate { background: var(--lf-sw-slate-bg); color: var(--lf-sw-slate-fg); }
    .tag--sw-sand { background: var(--lf-sw-sand-bg); color: var(--lf-sw-sand-fg); }

    /* Reserved treatments, driven by kind rather than swatch — a renamed won or lost
       stage must still look closed. Same visual language the six-status version used. */
    .tag--won {
      background: var(--lf-stage-won-bg);
      color: var(--lf-stage-won-fg);
      border-color: var(--lf-stage-won-bg);
    }
    .tag--lost {
      background: var(--lf-stage-lost-bg);
      color: var(--lf-stage-lost-fg);
      border-color: var(--lf-stage-lost-border);
    }
  `,
})
export class StageTag {
  readonly stage = input.required<Stage>();
  /** Short form where the column or filter already supplies the context. */
  readonly short = input(false);

  protected tagClass(): string {
    const stage = this.stage();
    if (stage.kind === 'won') return 'tag tag--won';
    if (stage.kind === 'lost') return 'tag tag--lost';
    return `tag tag--sw-${stage.swatch}`;
  }

  protected label(): string {
    const stage = this.stage();
    return this.short() ? (stage.shortName ?? stage.name) : stage.name;
  }
}
