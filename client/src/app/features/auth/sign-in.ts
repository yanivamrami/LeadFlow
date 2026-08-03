import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { COPY } from '../../core/copy';
import { NotifyService } from '../../core/notify.service';
import { SupabaseService } from '../../core/supabase.service';
import { TextField } from '../../shared/text-field';
import { AuthPage } from './auth-page';
import { CommitBand } from './commit-band';
import { FormError } from '../../shared/form-error';
import { PasteStrip, StripRow } from './paste-strip';
import { emailError, passwordError, safeReturnUrl, submitError } from './validate';

/**
 * 6.1 — sign in. The overwhelmingly common arrival: someone who already has an account,
 * on a phone, wanting the board. So there is nothing here to read, no value proposition,
 * and no third field. Two lines and a red band.
 *
 * The password error never names which of the two was wrong — that would tell an
 * attacker which addresses are registered.
 */
@Component({
  selector: 'lf-sign-in',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthPage, TextField, CommitBand, FormError, PasteStrip],
  template: `
    <lf-auth-page [title]="copy.auth.signIn.title" (submitted)="submit()">
      <lf-text-field
        name="email"
        type="email"
        autocomplete="email"
        inputmode="email"
        enterkeyhint="next"
        [label]="copy.auth.emailLabel"
        [error]="emailProblem()"
        [disabled]="busy()"
        [(value)]="email"
      />

      <lf-text-field
        name="password"
        type="password"
        autocomplete="current-password"
        enterkeyhint="go"
        [label]="copy.auth.passwordLabel"
        [error]="passwordProblem()"
        [disabled]="busy()"
        [(value)]="password"
      />

      <lf-form-error [message]="serverProblem()" />

      <lf-commit-band [label]="copy.auth.signIn.submit" [busy]="busy()" />

      <lf-paste-strip foot [rows]="footRows" />
    </lf-auth-page>
  `,
})
export class SignIn {
  private readonly supabase = inject(SupabaseService);
  private readonly notify = inject(NotifyService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly copy = COPY;

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly busy = signal(false);
  protected readonly serverProblem = signal<string | null>(null);

  /** Nothing is marked wrong until they have asked for it to be checked. */
  private readonly tried = signal(false);

  protected readonly emailProblem = computed(() =>
    this.tried() ? emailError(this.email()) : null,
  );
  /** No length rule on sign-in: an old password that predates the rule still has to work. */
  protected readonly passwordProblem = computed(() =>
    this.tried() ? passwordError(this.password(), false) : null,
  );

  protected readonly footRows: readonly StripRow[] = [
    {
      text: this.copy.auth.signIn.noAccount,
      linkLabel: this.copy.auth.signIn.createOne,
      link: '/auth/sign-up',
    },
    {
      text: this.copy.auth.signIn.forgot,
      linkLabel: this.copy.auth.reset.title,
      link: '/auth/reset',
    },
  ];

  protected async submit(): Promise<void> {
    this.tried.set(true);
    this.serverProblem.set(null);
    if (this.emailProblem() || this.passwordProblem() || this.busy()) return;

    this.busy.set(true);
    try {
      await this.supabase.signIn(this.email().trim(), this.password());
      const target = safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
      await this.router.navigateByUrl(target);
    } catch (error) {
      this.serverProblem.set(submitError(error, this.notify.online()));
    } finally {
      this.busy.set(false);
    }
  }
}
