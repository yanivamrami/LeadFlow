import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import {
  LucideBell,
  LucideChartNoAxesColumn,
  LucideCircleQuestionMark,
  LucideClipboardList,
  LucideList,
  LucideLogOut,
  LucidePlus,
  LucideUser,
} from '@lucide/angular';

import { APP_NAME, APP_SUB, COPY } from '../../core/copy';
import { HelpService } from '../../core/help.service';
import {
  digestAlreadyShown,
  digestMessage,
  markDigestShown,
} from '../../core/reminder-digest';
import { NotifyService } from '../../core/notify.service';
import { RemindersStore } from '../../core/reminders.store';
import { SupabaseService } from '../../core/supabase.service';
import { LegendDialog } from '../../shared/legend-dialog';
import { OfflineBanner } from '../../shared/offline-banner';

/**
 * The signed-in shell. Ink masthead at every size; below 900px the nav moves to a bottom
 * bar and the primary action becomes a full-width red band — the one place red owns a
 * whole region.
 *
 * It is a routed layout rather than the app root, because the signed-out screens must
 * not carry it: an auth screen with a nav bar offers destinations that would only bounce
 * the visitor back.
 */
@Component({
  selector: 'lf-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    LucideBell,
    LucideList,
    LucideClipboardList,
    LucideChartNoAxesColumn,
    LucideUser,
    LucidePlus,
    LucideCircleQuestionMark,
    LucideLogOut,
    OfflineBanner,
    LegendDialog,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly supabase = inject(SupabaseService);
  private readonly help = inject(HelpService);
  private readonly reminders = inject(RemindersStore);
  private readonly notify = inject(NotifyService);
  private readonly router = inject(Router);

  constructor() {
    // Once, on shell init rather than per navigation: the badge must be right on every
    // route, including the ones that never load the pipeline.
    void this.reminders.load().then(() => this.announceDigest());
  }

  /**
   * 4.3 — one toast per session when something is due, and nothing otherwise. Never the
   * critical popup: `failedToPersist` takes a FailedWrite and a digest is not one, so
   * that door stays shut.
   */
  private announceDigest(): void {
    const message = digestMessage({
      overdue: this.reminders.overdue().length,
      today: this.reminders.today().length,
      alreadyShown: digestAlreadyShown(),
      loaded: this.reminders.loaded(),
      online: this.notify.online(),
      onRemindersRoute: this.router.url.startsWith('/reminders'),
    });
    if (!message) return;

    markDigestShown();
    this.notify.info(message, {
      label: COPY.reminders.toastAction,
      run: () => void this.router.navigate(['/reminders']),
    });
  }

  protected readonly appName = APP_NAME;
  protected readonly appSub = APP_SUB;
  protected readonly copy = COPY;

  /**
   * Scheduled work only — overdue plus due today. Five drifting leads produce no badge,
   * because nothing is scheduled: the bell is the user's own calendar, and pipeline
   * attention already has the day sheet, the flags and the urgency sort.
   */
  protected readonly reminderCount = this.reminders.openCount;

  /** The badge's accessible name. A computed rather than a call in the aria binding: the
   *  string changes only when the count does, not on every change-detection pass. */
  protected readonly reminderBadgeLabel = computed(() =>
    COPY.shell.remindersBadge(this.reminderCount()),
  );

  protected readonly displayName = this.supabase.displayName;

  /** First letter of the real name — Hebrew or Latin, whatever they typed at signup. */
  protected readonly monogram = computed(() => this.displayName().trim().charAt(0) || '·');

  /**
   * The masthead's own way out — outermost, inline-end of the monogram: account, then
   * leave. Same flow as the profile screen's `יציאה`, from SupabaseService, so the two
   * doors cannot behave differently.
   */
  protected readonly signingOut = this.supabase.signingOut;

  protected signOut(): void {
    void this.supabase.signOutAndLeave();
  }

  protected openHelp(): void {
    this.help.show();
  }
}
