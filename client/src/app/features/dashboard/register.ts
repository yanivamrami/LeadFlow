import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { COPY, SOURCE_LABEL, STATUS_LABEL, formatValue, formatWhen } from '../../core/copy';
import { Lead, LeadStatus } from '../../core/lead.model';
import { LeadsStore } from '../../core/leads.store';
import { LeadMenu } from '../../shared/lead-menu';
import { StageTag } from '../../shared/stage-tag';

/**
 * The register — every lead, ranked by urgency. Attention is a flag stuck to the row's
 * inline-start edge: solid yellow means "needs you", hatched means "drifting". Texture and
 * fill differ, not only hue, so the distinction survives greyscale and colour blindness.
 */
@Component({
  selector: 'lf-register',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StageTag, LeadMenu],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  private readonly store = inject(LeadsStore);

  protected readonly copy = COPY;
  protected readonly sourceLabel = SOURCE_LABEL;
  protected readonly formatValue = formatValue;

  protected readonly leads = this.store.visibleLeads;
  protected readonly total = this.store.total;
  protected readonly isFiltered = this.store.isFiltered;

  protected attention(lead: Lead): 'now' | 'drift' | 'none' {
    return this.store.attentionOf(lead);
  }

  protected when(lead: Lead): string {
    return formatWhen(lead.lastTouchAt, this.store.now());
  }

  protected silentDays(lead: Lead): number {
    return this.store.ageInDays(lead);
  }

  protected move(lead: Lead, status: LeadStatus): void {
    this.store.moveToStage(lead.id, status, STATUS_LABEL[status]);
  }

  protected log(lead: Lead): void {
    this.store.logActivity(lead.id, COPY.menu.logActivity);
  }

  protected snooze(lead: Lead): void {
    this.store.snooze(lead.id);
  }

  protected remove(lead: Lead): void {
    this.store.remove(lead.id);
  }

  protected clearFilters(): void {
    this.store.clearFilters();
  }
}
