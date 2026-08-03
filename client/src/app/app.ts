import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import {
  LucideBell,
  LucideChartNoAxesColumn,
  LucideClipboardList,
  LucideList,
  LucidePlus,
  LucideUser,
} from '@lucide/angular';

import { APP_NAME, APP_SUB, COPY } from './core/copy';
import { SupabaseService } from './core/supabase.service';
import { AlertDialog } from './shared/alert-dialog';
import { OfflineBanner } from './shared/offline-banner';
import { ToastStack } from './shared/toast-stack';

/**
 * The shell. Ink masthead at every size; below 900px the nav moves to a bottom bar and the
 * primary action becomes a full-width red band — the one place red owns a whole region.
 */
@Component({
  selector: 'app-root',
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
    OfflineBanner,
    ToastStack,
    AlertDialog,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  protected readonly appName = APP_NAME;
  protected readonly appSub = APP_SUB;
  protected readonly copy = COPY;
  /** Open reminders. Wired to the store once reminders get their own route. */
  protected readonly reminderCount = 3;

  /** The shell is chrome for a signed-in session; sign-in renders on its own. */
  protected readonly signedIn = this.supabase.isAuthenticated;

  protected readonly initial = () => {
    const email = this.supabase.user()?.email ?? '';
    return email.charAt(0).toUpperCase() || '·';
  };

  protected async signOut(): Promise<void> {
    await this.supabase.signOut();
    await this.router.navigate(['/sign-in']);
  }
}
