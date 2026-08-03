import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { LucideLogOut } from '@lucide/angular';

import { COPY } from '../../core/copy';
import { NotifyService } from '../../core/notify.service';
import { isAppError, SupabaseService } from '../../core/supabase.service';
import { ThemeChoice, ThemeService } from '../../core/theme.service';
import { FormError } from '../../shared/form-error';
import { TextField } from '../../shared/text-field';
import { matchError, nameError, passwordError } from '../auth/validate';

/**
 * 6.6 — profile and account settings.
 *
 * A rare, deliberate visit, so it is built as a register: sections under rules, one row
 * per thing, each stating its own consequence. No preference here is a toy — the name is
 * what the masthead and any teammate sees, the password is the only key, and the last
 * section ends the account.
 *
 * That last section sits on the hatch used everywhere else for drift and for lost leads:
 * texture rather than a red panel, so the warning survives greyscale and does not spend
 * the commit colour on a link.
 */
@Component({
  selector: 'lf-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideLogOut, TextField, FormError],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile {
  private readonly supabase = inject(SupabaseService);
  private readonly notify = inject(NotifyService);
  private readonly router = inject(Router);

  protected readonly theme = inject(ThemeService);
  protected readonly copy = COPY;

  protected readonly email = this.supabase.email;

  /* ---------- name ---------- */

  private readonly savedName = signal(this.supabase.displayName());
  protected readonly name = signal(this.supabase.displayName());
  protected readonly savingName = signal(false);
  protected readonly nameServerProblem = signal<string | null>(null);
  private readonly nameTried = signal(false);

  protected readonly nameProblem = computed(() =>
    this.nameTried() ? nameError(this.name()) : null,
  );
  /** Save stays inert until there is a change to save — a no-op write is not a feature. */
  protected readonly nameChanged = computed(() => this.name().trim() !== this.savedName().trim());

  /* ---------- password ---------- */

  protected readonly current = signal('');
  protected readonly fresh = signal('');
  protected readonly confirm = signal('');
  protected readonly savingPassword = signal(false);
  protected readonly passwordServerProblem = signal<string | null>(null);
  private readonly passwordTried = signal(false);

  protected readonly currentProblem = computed(() =>
    this.passwordTried() ? passwordError(this.current(), false) : null,
  );
  protected readonly freshProblem = computed(() =>
    this.passwordTried() ? passwordError(this.fresh(), true) : null,
  );
  protected readonly confirmProblem = computed(() =>
    this.passwordTried() ? matchError(this.fresh(), this.confirm()) : null,
  );

  /* ---------- the rest ---------- */

  protected readonly signingOut = signal(false);

  protected readonly themeOptions: readonly { value: ThemeChoice; label: string }[] = [
    { value: 'light', label: COPY.profile.themeLight },
    { value: 'dark', label: COPY.profile.themeDark },
    { value: 'system', label: COPY.profile.themeSystem },
  ];

  protected async saveName(): Promise<void> {
    this.nameTried.set(true);
    this.nameServerProblem.set(null);
    if (this.nameProblem() || this.savingName() || !this.nameChanged()) return;

    const next = this.name().trim();
    this.savingName.set(true);
    try {
      await this.supabase.updateDisplayName(next);
      this.savedName.set(next);
      this.name.set(next);
      this.nameTried.set(false);
      this.notify.succeeded(COPY.profile.saved);
    } catch (error) {
      this.nameServerProblem.set(isAppError(error) ? error.message : COPY.errors.generic);
    } finally {
      this.savingName.set(false);
    }
  }

  protected async changePassword(): Promise<void> {
    this.passwordTried.set(true);
    this.passwordServerProblem.set(null);
    if (
      this.currentProblem() ||
      this.freshProblem() ||
      this.confirmProblem() ||
      this.savingPassword()
    ) {
      return;
    }

    this.savingPassword.set(true);
    try {
      // GoTrue does not ask for the old password (secure_password_change is off), so
      // this is where "prove you are the person, not the borrowed phone" happens.
      await this.supabase.reauthenticate(this.current());
      await this.supabase.updatePassword(this.fresh());

      this.current.set('');
      this.fresh.set('');
      this.confirm.set('');
      this.passwordTried.set(false);
      this.notify.succeeded(COPY.profile.passwordChanged);
    } catch (error) {
      this.passwordServerProblem.set(isAppError(error) ? error.message : COPY.errors.generic);
    } finally {
      this.savingPassword.set(false);
    }
  }

  protected async signOut(): Promise<void> {
    if (this.signingOut()) return;
    this.signingOut.set(true);
    try {
      await this.supabase.signOut();
      await this.router.navigateByUrl('/auth/sign-in');
      this.notify.succeeded(COPY.profile.signedOut);
    } catch (error) {
      this.notify.failed(isAppError(error) ? error.message : COPY.errors.generic);
    } finally {
      this.signingOut.set(false);
    }
  }
}
