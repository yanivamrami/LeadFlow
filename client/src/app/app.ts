import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ThemeService } from './core/theme.service';
import { AlertDialog } from './shared/alert-dialog';
import { ToastStack } from './shared/toast-stack';

/**
 * The root holds only what has to outlive every route: the toast stack and the
 * failed-write dialog, which must survive the navigation that provoked them.
 *
 * The masthead, tabs and action band live in `Shell` (features/shell), a routed layout
 * behind `authGuard`. They used to sit here behind an `@if (signedIn())`, which meant the
 * signed-out screens rendered inside the shell's padding and the outlet was torn down and
 * rebuilt on every sign-in. A layout route states the same thing in the router, where it
 * belongs — and the auth screens get a genuinely bare page.
 *
 * The offline banner moved into the shell too, because the design puts it under the
 * masthead where it pushes content down; there is no masthead to sit under out here.
 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ToastStack, AlertDialog],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  constructor() {
    // Constructed for its side effect: it stamps `data-theme` on <html> and keeps it in
    // step with the system preference. Nothing in the template reads it.
    inject(ThemeService);
  }
}
