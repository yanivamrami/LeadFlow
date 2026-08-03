import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { COPY } from '../../core/copy';
import { isAppError, SupabaseService } from '../../core/supabase.service';
import { TextField } from '../../shared/text-field';
import { AuthPage } from './auth-page';
import { CommitBand } from './commit-band';
import { FormError } from '../../shared/form-error';
import { PasteStrip, StripRow } from './paste-strip';
import { emailError, nameError, passwordError } from './validate';

/**
 * 6.2 — sign up. Three fields, and one yellow field that says what pressing the button
 * actually does.
 *
 * That yellow block is the product's day-sheet mechanic borrowed one screen early: this
 * is the only place in the app where a beginner is asked to commit before they have seen
 * anything, so the promise is stated at the size the promise deserves. It is also why
 * there is no separate first-run welcome screen — the teaching happens here, and then
 * the board they land on already has a lead in it.
 *
 * The name is not decoration. `handle_new_user` reads it out of the signup metadata to
 * name the profile *and* the auto-created tenant.
 */
@Component({
  selector: 'lf-sign-up',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthPage, TextField, CommitBand, FormError, PasteStrip],
  template: `
    <lf-auth-page [title]="copy.auth.signUp.title" (submitted)="submit()">
      <lf-text-field
        name="name"
        autocomplete="name"
        enterkeyhint="next"
        [label]="copy.auth.signUp.nameLabel"
        [help]="copy.auth.signUp.nameHelp"
        [error]="nameProblem()"
        [disabled]="busy()"
        [(value)]="name"
      />

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
        autocomplete="new-password"
        enterkeyhint="go"
        [label]="copy.auth.passwordLabel"
        [help]="copy.auth.signUp.passwordHelp"
        [error]="passwordProblem()"
        [disabled]="busy()"
        [(value)]="password"
      />

      <section class="next">
        <h2 class="lf-label">{{ copy.auth.signUp.nextTitle }}</h2>
        <p>{{ copy.auth.signUp.nextBody }}</p>
      </section>

      <lf-form-error [message]="serverProblem()" />

      <lf-commit-band [label]="copy.auth.signUp.submit" [busy]="busy()" />

      <lf-paste-strip foot [rows]="footRows" />
    </lf-auth-page>
  `,
  styles: `
    /* the one fluorescent field on a signed-out screen. It states an outcome, which is
       what yellow means everywhere else in this product. */
    .next {
      margin-block-start: var(--lf-space-6);
      margin-inline: var(--lf-bleed, 0);
      padding: var(--lf-space-4);
      border-block: var(--lf-rule-w) solid var(--lf-ink);
      background: var(--lf-day);
      color: var(--lf-on-day);
    }
    .next h2 {
      margin: 0 0 6px;
      text-transform: none;
    }
    .next p {
      margin: 0;
      max-inline-size: 46ch;
      font-size: var(--lf-size-body);
      line-height: 1.5;
      text-wrap: pretty;
    }
  `,
})
export class SignUp {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  protected readonly copy = COPY;

  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly busy = signal(false);
  protected readonly serverProblem = signal<string | null>(null);

  private readonly tried = signal(false);

  protected readonly nameProblem = computed(() => (this.tried() ? nameError(this.name()) : null));
  protected readonly emailProblem = computed(() =>
    this.tried() ? emailError(this.email()) : null,
  );
  protected readonly passwordProblem = computed(() =>
    this.tried() ? passwordError(this.password(), true) : null,
  );

  protected readonly footRows: readonly StripRow[] = [
    {
      text: this.copy.auth.signUp.haveAccount,
      linkLabel: this.copy.auth.signUp.signInInstead,
      link: '/auth/sign-in',
    },
  ];

  protected async submit(): Promise<void> {
    this.tried.set(true);
    this.serverProblem.set(null);
    if (this.nameProblem() || this.emailProblem() || this.passwordProblem() || this.busy()) return;

    this.busy.set(true);
    try {
      await this.supabase.signUp(this.email().trim(), this.password(), this.name().trim());

      // With confirmations off (supabase/config.toml, auth.email.enable_confirmations)
      // signup returns a session and the board is one navigation away. If that setting is
      // ever turned on, there is no session yet — say so rather than bouncing silently.
      if (this.supabase.isAuthenticated()) {
        await this.router.navigateByUrl('/');
      } else {
        this.serverProblem.set(COPY.errors.emailNotConfirmed);
      }
    } catch (error) {
      this.serverProblem.set(isAppError(error) ? error.message : COPY.errors.generic);
    } finally {
      this.busy.set(false);
    }
  }
}
