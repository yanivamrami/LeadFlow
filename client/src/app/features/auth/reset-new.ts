import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { COPY } from '../../core/copy';
import { NotifyService } from '../../core/notify.service';
import { isAppError, SupabaseService } from '../../core/supabase.service';
import { TextField } from '../../shared/text-field';
import { AuthPage } from './auth-page';
import { CommitBand } from './commit-band';
import { FormError } from '../../shared/form-error';
import { PasteStrip, StripRow } from './paste-strip';
import { matchError, passwordError } from './validate';

type Phase = 'checking' | 'ready' | 'expired';

/**
 * 6.4 — set the new password, arrived at from the recovery link.
 *
 * The link carries its tokens in the URL fragment; supabase-js consumes them on startup
 * and turns them into a real session, which is why this route is outside `guestGuard`.
 * It is also why the expired case has to be a designed state rather than a crash: the
 * link is one-use and one-hour, and landing here on a dead one is ordinary, not
 * exceptional. GoTrue announces that failure in the fragment too, so a dead link is
 * recognised before the session check even runs.
 */
@Component({
  selector: 'lf-reset-new',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthPage, TextField, CommitBand, FormError, PasteStrip],
  template: `
    <lf-auth-page [title]="title()" [intro]="intro()" (submitted)="submit()">
      @switch (phase()) {
        @case ('ready') {
          <lf-text-field
            name="password"
            type="password"
            autocomplete="new-password"
            enterkeyhint="next"
            [label]="copy.auth.newPassword.label"
            [help]="copy.auth.signUp.passwordHelp"
            [error]="passwordProblem()"
            [disabled]="busy()"
            [(value)]="password"
          />

          <lf-text-field
            name="confirm"
            type="password"
            autocomplete="new-password"
            enterkeyhint="go"
            [label]="copy.auth.newPassword.confirmLabel"
            [error]="confirmProblem()"
            [disabled]="busy()"
            [(value)]="confirm"
          />

          <lf-form-error [message]="serverProblem()" />

          <lf-commit-band [label]="copy.auth.newPassword.submit" [busy]="busy()" />
        }
        @case ('expired') {
          <lf-paste-strip [rows]="expiredRows" />
        }
      }

      @if (phase() !== 'expired') {
        <lf-paste-strip foot [rows]="footRows" />
      }
    </lf-auth-page>
  `,
})
export class ResetNew {
  private readonly supabase = inject(SupabaseService);
  private readonly notify = inject(NotifyService);
  private readonly router = inject(Router);

  protected readonly copy = COPY;

  protected readonly password = signal('');
  protected readonly confirm = signal('');
  protected readonly busy = signal(false);
  protected readonly serverProblem = signal<string | null>(null);
  protected readonly phase = signal<Phase>('checking');

  private readonly tried = signal(false);

  protected readonly passwordProblem = computed(() =>
    this.tried() ? passwordError(this.password(), true) : null,
  );
  protected readonly confirmProblem = computed(() =>
    this.tried() ? matchError(this.password(), this.confirm()) : null,
  );

  protected readonly title = computed(() =>
    this.phase() === 'expired'
      ? this.copy.auth.newPassword.expiredTitle
      : this.copy.auth.newPassword.title,
  );

  /** `checking` shows the heading with no body — a spinner for a 100ms wait is noise. */
  protected readonly intro = computed(() => {
    switch (this.phase()) {
      case 'expired':
        return this.copy.auth.newPassword.expiredBody;
      case 'ready':
        return this.copy.auth.newPassword.lead;
      default:
        return null;
    }
  });

  protected readonly expiredRows: readonly StripRow[] = [
    {
      text: this.copy.auth.newPassword.expiredTitle,
      linkLabel: this.copy.auth.newPassword.requestNew,
      link: '/auth/reset',
    },
  ];

  protected readonly footRows: readonly StripRow[] = [
    {
      text: this.copy.auth.signUp.haveAccount,
      linkLabel: this.copy.auth.reset.back,
      link: '/auth/sign-in',
    },
  ];

  constructor() {
    // GoTrue reports a dead link in the fragment (`#error=access_denied&error_code=…`)
    // rather than as a failed request, so this is the earliest and cheapest check.
    const fragment = typeof window === 'undefined' ? '' : window.location.hash;
    if (fragment.includes('error')) {
      this.phase.set('expired');
      return;
    }

    void this.supabase.whenReady.then(() => {
      this.phase.set(this.supabase.isAuthenticated() ? 'ready' : 'expired');
    });
  }

  protected async submit(): Promise<void> {
    if (this.phase() !== 'ready') return;

    this.tried.set(true);
    this.serverProblem.set(null);
    if (this.passwordProblem() || this.confirmProblem() || this.busy()) return;

    this.busy.set(true);
    try {
      await this.supabase.updatePassword(this.password());
      this.notify.succeeded(COPY.auth.newPassword.changed);
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.serverProblem.set(isAppError(error) ? error.message : COPY.errors.generic);
    } finally {
      this.busy.set(false);
    }
  }
}
