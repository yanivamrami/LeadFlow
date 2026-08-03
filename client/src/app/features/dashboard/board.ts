import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragPlaceholder,
  CdkDropList,
  CdkDropListGroup,
} from '@angular/cdk/drag-drop';

import { COPY, STATUS_LABEL, formatValue, formatWhen } from '../../core/copy';
import { CHECKLIST_ITEMS, Lead, LeadStatus } from '../../core/lead.model';
import { LeadsStore } from '../../core/leads.store';
import { LeadMenu } from '../../shared/lead-menu';

/**
 * The board — six posted bills, running right-to-left with stage 1 at the inline-start edge.
 * Drag uses Angular CDK, not PrimeNG's pDraggable, because the latter relies on HTML5
 * native DnD and has no touch support (docs/ARCHITECTURE.md §7). Drag is never the only
 * path: every card carries the same stage menu the register uses.
 */
@Component({
  selector: 'lf-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CdkDropListGroup, CdkDropList, CdkDrag, CdkDragPlaceholder, LeadMenu],
  templateUrl: './board.html',
  styleUrl: './board.scss',
})
export class Board {
  private readonly store = inject(LeadsStore);
  private readonly router = inject(Router);

  protected readonly copy = COPY;
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly formatValue = formatValue;
  protected readonly checklistTotal = CHECKLIST_ITEMS.length;

  protected readonly columns = this.store.columns;

  protected attention(lead: Lead): 'now' | 'drift' | 'none' {
    return this.store.attentionOf(lead);
  }

  protected when(lead: Lead): string {
    return formatWhen(lead.lastTouchAt, this.store.now());
  }

  protected drop(event: CdkDragDrop<LeadStatus>, status: LeadStatus): void {
    if (event.previousContainer === event.container) return;
    const lead = event.item.data as Lead;
    this.store.moveToStage(lead.id, status, STATUS_LABEL[status]);
  }

  protected move(lead: Lead, status: LeadStatus): void {
    this.store.moveToStage(lead.id, status, STATUS_LABEL[status]);
  }

  /** Opens the composer rather than writing — see Register.log for why. */
  protected log(lead: Lead): void {
    void this.router.navigate(['/lead', lead.id], { queryParams: { at: 'note' } });
  }

  protected snooze(lead: Lead, due: Date): void {
    void this.store.snooze(lead.id, due);
  }

  protected remove(lead: Lead): void {
    this.store.remove(lead.id);
  }
}
