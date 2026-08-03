import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { STATUS_LABEL, STATUS_SHORT } from '../core/copy';
import { LeadStatus } from '../core/lead.model';

/**
 * Pipeline stage as a posted block. Colour never carries the meaning alone — the Hebrew
 * label always ships with it, and the ramp (paper → tan → deep tan → ink → red, hatched
 * at Lost) stays legible in greyscale.
 */
@Component({
  selector: 'lf-stage-tag',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="tag" [class]="'tag--' + status()">{{ label() }}</span>`,
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

    .tag--new { background: var(--lf-stage-new-bg); color: var(--lf-stage-new-fg); }
    .tag--contacted { background: var(--lf-stage-contacted-bg); color: var(--lf-stage-contacted-fg); }
    .tag--qualified { background: var(--lf-stage-qualified-bg); color: var(--lf-stage-qualified-fg); }
    .tag--proposal_sent { background: var(--lf-stage-proposal-bg); color: var(--lf-stage-proposal-fg); }
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
  readonly status = input.required<LeadStatus>();
  /** Short form where the column or filter already supplies the context. */
  readonly short = input(false);

  protected label(): string {
    return this.short() ? STATUS_SHORT[this.status()] : STATUS_LABEL[this.status()];
  }
}
