import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ThemeService } from './core/theme.service';
import { AlertDialog } from './shared/alert-dialog';
import { OfflineBanner } from './shared/offline-banner';
import { ToastStack } from './shared/toast-stack';

/**
 * The app root holds only what outlives every route: the offline banner, the toast
 * stack, the interrupt, and the outlet. The masthead and tabs live in `Shell`, the
 * layout for signed-in routes — the auth screens must not carry navigation to places
 * that would only bounce the visitor back.
 *
 * ThemeService is injected here rather than lazily, so the stored choice applies to the
 * first screen anyone sees, signed in or not.
 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, OfflineBanner, ToastStack, AlertDialog],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  constructor() {
    inject(ThemeService);
  }
}
