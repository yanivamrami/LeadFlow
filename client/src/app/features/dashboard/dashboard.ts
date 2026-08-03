import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';

import { LucideColumns3, LucideList, LucideSearch } from '@lucide/angular';

import { COPY, STATUS_LABEL, STATUS_SHORT } from '../../core/copy';
import { LEAD_SOURCES, LeadSource, LeadStatus, STAGE_ORDER } from '../../core/lead.model';
import { LeadsStore } from '../../core/leads.store';
import { Board } from './board';
import { DaySheet } from './day-sheet';
import { Register } from './register';

/** The board needs six columns to be honest; below this the register is the view. */
const BOARD_MIN_WIDTH = 768;

@Component({
  selector: 'lf-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterOutlet,
    LucideSearch,
    LucideList,
    LucideColumns3,
    DaySheet,
    Register,
    Board,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly store = inject(LeadsStore);
  private readonly route = inject(ActivatedRoute);

  protected readonly copy = COPY;
  protected readonly stages = STAGE_ORDER;
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly statusShort = STATUS_SHORT;

  protected readonly counts = this.store.countByStatus;
  protected readonly total = this.store.total;
  protected readonly statusFilter = this.store.statusFilter;
  protected readonly search = this.store.search;
  protected readonly announcement = this.store.announcement;

  private readonly wide = signal(this.readWide());

  /** The toggle is only offered where six columns actually fit. */
  protected readonly canBoard = this.wide.asReadonly();
  protected readonly view = computed(() => (this.wide() ? this.store.view() : 'list'));

  protected readonly loading = this.store.loading;
  protected readonly loaded = this.store.loaded;
  protected readonly loadFailed = this.store.loadFailed;

  /**
   * `?source=` arrives from an insights row, and the router reuses this component
   * across a query-param-only navigation — so this reads the param as a stream, not a
   * constructor-time snapshot, or clicking a second source from insights would do
   * nothing the second time.
   */
  private readonly sourceParam = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('source'))),
    { initialValue: this.route.snapshot.queryParamMap.get('source') },
  );

  protected retry(): void {
    void this.store.load();
  }

  constructor() {
    void this.store.load();

    effect(() => {
      this.store.setSourceFilter(this.validateSource(this.sourceParam()));
    });

    if (typeof window !== 'undefined') {
      const query = window.matchMedia(`(min-width: ${BOARD_MIN_WIDTH}px)`);
      const onChange = () => this.wide.set(query.matches);
      query.addEventListener('change', onChange);
      inject(DestroyRef).onDestroy(() => query.removeEventListener('change', onChange));
    }
  }

  /**
   * Never an empty board: an unrecognised or absent source falls back to showing
   * everything, the same precedent `safeReturnUrl` set for untrusted query input.
   */
  private validateSource(value: string | null): LeadSource | 'all' {
    if (!value) return 'all';
    return (LEAD_SOURCES as readonly string[]).includes(value) ? (value as LeadSource) : 'all';
  }

  protected setSearch(term: string): void {
    this.store.setSearch(term);
  }

  protected setFilter(status: LeadStatus | 'all'): void {
    this.store.setStatusFilter(status);
  }

  protected setView(view: 'list' | 'board'): void {
    this.store.setView(view);
  }

  private readWide(): boolean {
    if (typeof window === 'undefined') return true;
    return window.matchMedia(`(min-width: ${BOARD_MIN_WIDTH}px)`).matches;
  }
}
