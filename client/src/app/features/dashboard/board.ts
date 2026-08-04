import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragPlaceholder,
  CdkDropList,
  CdkDropListGroup,
} from '@angular/cdk/drag-drop';

import { COPY, formatWhen } from '../../core/copy';
import { GuidanceService } from '../../core/guidance.service';
import { Attention, CHECKLIST_ITEMS, Lead, Stage } from '../../core/lead.model';
import { LeadsStore } from '../../core/leads.store';
import { LeadMenu } from '../../shared/lead-menu';
import { ValuePipe } from '../../shared/format.pipes';

/** A card's lead with its urgency flag and note line already resolved — see `columns`. */
export interface BoardRow {
  lead: Lead;
  attention: Attention;
  /** Either the checklist nudge or the last-touch stamp, never both — see `noteFor`. */
  note: string;
}

/**
 * The board — six posted bills, running right-to-left with stage 1 at the inline-start edge.
 * Drag uses Angular CDK, not PrimeNG's pDraggable, because the latter relies on HTML5
 * native DnD and has no touch support (docs/ARCHITECTURE.md §7). Drag is never the only
 * path: every card carries the same stage menu the register uses.
 */
@Component({
  selector: 'lf-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    CdkDragPlaceholder,
    LeadMenu,
    ValuePipe,
  ],
  templateUrl: './board.html',
  styleUrl: './board.scss',
})
export class Board {
  private readonly store = inject(LeadsStore);
  protected readonly guidance = inject(GuidanceService);
  private readonly router = inject(Router);

  protected readonly copy = COPY;
  protected readonly checklistTotal = CHECKLIST_ITEMS.length;

  /**
   * Columns whose cards already carry their urgency flag and note line. `attention(lead)`
   * and the checklist/when decision both read the store's clock, so calling them from the
   * template ran per card, per binding, on every change-detection pass; this derives both
   * once per change and keeps `cdkDragData` pointed at the real lead underneath.
   */
  protected readonly columns = computed(() => {
    const now = this.store.now();
    return this.store.columns().map((column) => ({
      stage: column.stage,
      leads: column.leads.map((lead) => this.toRow(lead, now)),
    }));
  });

  private toRow(lead: Lead, now: Date): BoardRow {
    return {
      lead,
      attention: this.store.attentionOf(lead, now),
      note: this.noteFor(lead, now),
    };
  }

  /**
   * The checklist nudge while a lead is open and unqualified; the last-touch stamp once it
   * has moved on. `checklistProgress` was a copy-map call and `when` read the store's clock
   * — both used to run from the template, per card, per change-detection pass.
   */
  private noteFor(lead: Lead, now: Date): string {
    if (lead.checklistAnswered < this.checklistTotal && lead.stage.kind === 'open') {
      return COPY.board.checklistProgress(lead.checklistAnswered, this.checklistTotal);
    }
    return formatWhen(lead.lastTouchAt, now);
  }

  protected drop(event: CdkDragDrop<Stage>, stage: Stage): void {
    if (event.previousContainer === event.container) return;
    const lead = event.item.data as Lead;
    this.store.moveToStage(lead.id, stage);
  }

  protected move(lead: Lead, stage: Stage): void {
    this.store.moveToStage(lead.id, stage);
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
