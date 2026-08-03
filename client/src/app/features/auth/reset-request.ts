import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { COPY } from '../../core/copy';
import { isAppError, SupabaseService } from '../../core/supabase.service';
import { TextField } from '../../shared/text-field';
import { AuthPage } from './auth-page';
import { CommitBand } from './commit-band';
import { FormError } from '../../shared/form-error';
import { PasteStrip, StripRow } from './paste-strip';
import { emailError } from './validate';

/**
 * 6.3 — ask for a reset link.
 *
 * Sending resolves the same way whether or not the address is registered, and the
 * confirmation copy says "if it is registered" for exactly that reason: a screen that
 * distinguishes the two is a free tool for checking which of a list of emails has an
 * account here.
 *
 * The screen replaces itself with the confirmation rather than showing a toast over a
 * form that is now pointless to fill in again.
 */
@Component({
  selector: 'lf-reset-request',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthPage, TextField, CommitBand, FormError, PasteStrip],
  template: `
    <lf-auth-page [title]="title()" [intro]="intro()" (submitted)="submit()">
      @if (sent()) {
        <button type="button" class="b" [disabled]="busy()" (click)="submit()">
          {{ busy() ? copy.auth.working : copy.auth.reset.resend }}
        </button>
        <lf-form-error [message]="serverProblem()" />
      } @else {
        <lf-text-field
          name="email"
          type="email"
          autocomplete="email"
          inputmode="email"
          enterkeyhint="send"
          [label]="copy.auth.emailLabel"
          [error]="emailProblem()"
          [disabled]="busy()"
          [(value)]="email"
        />

        <lf-form-error [message]="serverProblem()" />

        <lf-commit-band [label]="copy.auth.reset.submit" [busy]="busy()" />
      }

      <lf-paste-strip foot [rows]="footRows" />
    </lf-auth-page>
  `,
  styles: `
    /* the secondary weight: ink outline, never a second red band on one screen */
    .b {
      align-self: flex-start;
      min-block-size: var(--lf-touch);
      padding-inline: var(--lf-space-6);
      border: 2px solid var(--lf-ink);
      background: transparent;
      color: var(--lf-ink);
      font: inherit;
      font-weight: 500;
      cursor: pointer;
      transition: background var(--lf-dur-state) linear, color var(--lf-dur-state) linear;
    }
    .b:hover:not(:disabled) { background: var(--lf-ink); color: var(--lf-on-ink); }
    .b:disabled { color: var(--lf-muted); border-color: var(--lf-muted); cursor: not-allowed; }
  `,
})
export class ResetRequest {
  private readonly supabase = inject(SupabaseService);

  protected readonly copy = COPY;

  protected readonly email = signal('');
  protected readonly busy = signal(false);
  protected readonly sent = signal(false);
  protected readonly serverProblem = signal<string | null>(null);

  private readonly tried = signal(false);

  protected readonly emailProblem = computed(() =>
    this.tried() ? emailError(this.email()) : null,
  );

  protected readonly title = computed(() =>
    this.sent() ? this.copy.auth.reset.sentTitle : this.copy.auth.reset.title,
  );
  protected readonly intro = computed(() =>
    this.sent() ? this.copy.auth.reset.sentBody(this.email().trim()) : this.copy.auth.reset.lead,
  );

  protected readonly footRows: readonly StripRow[] = [
    {
      text: this.copy.auth.signUp.haveAccount,
      linkLabel: this.copy.auth.reset.back,
      link: '/auth/sign-in',
    },
  ];

  protected async submit(): Promise<void> {
    this.tried.set(true);
    this.serverProblem.set(null);
    if (this.emailProblem() || this.busy()) return;

    this.busy.set(true);
    try {
      await this.supabase.requestPasswordReset(this.email().trim());
      this.sent.set(true);
    } catch (error) {
      this.serverProblem.set(isAppError(error) ? error.message : COPY.errors.generic);
    } finally {
      this.busy.set(false);
    }
  }
}
