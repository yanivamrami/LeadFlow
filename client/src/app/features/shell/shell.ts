import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import {
  LucideBell,
  LucideChartNoAxesColumn,
  LucideCircleQuestionMark,
  LucideClipboardList,
  LucideList,
  LucidePlus,
  LucideUser,
} from '@lucide/angular';

import { APP_NAME, APP_SUB, COPY } from '../../core/copy';
import { HelpService } from '../../core/help.service';
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
    OfflineBanner,
    LegendDialog,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly supabase = inject(SupabaseService);
  private readonly help = inject(HelpService);

  protected readonly appName = APP_NAME;
  protected readonly appSub = APP_SUB;
  protected readonly copy = COPY;
  /** Open reminders. Wired to the store once reminders get their own route. */
  protected readonly reminderCount = 3;

  protected readonly displayName = this.supabase.displayName;

  /** First letter of the real name — Hebrew or Latin, whatever they typed at signup. */
  protected readonly monogram = computed(() => this.displayName().trim().charAt(0) || '·');

  protected openHelp(): void {
    this.help.show();
  }
}
