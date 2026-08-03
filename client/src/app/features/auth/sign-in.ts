import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { COPY } from '../../core/copy';
import { NotifyService } from '../../core/notify.service';
import { SupabaseService, isAppError } from '../../core/supabase.service';

/**
 * Sign-in. Deliberately minimal: every lead policy is `to authenticated`, so without a
 * session the dashboard reads an empty pipeline that looks identical to an empty tenant.
 * This exists to make the app reachable, not to be the finished auth surface — sign-up,
 * password reset and confirmation are still unbuilt (documents/SCREENS.md §6).
 */
@Component({
  selector: 'lf-sign-in',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <main class="wrap">
      <form class="card" (ngSubmit)="submit()">
        <h1 class="title">{{ copy.auth.title }}</h1>
        <p class="sub">{{ copy.auth.subtitle }}</p>

        <label class="field">
          <span class="field__label lf-label">{{ copy.auth.email }}</span>
          <input
            name="email"
            type="email"
            autocomplete="email"
            dir="ltr"
            required
            [(ngModel)]="email"
            [disabled]="busy()"
          />
        </label>

        <label class="field">
          <span class="field__label lf-label">{{ copy.auth.password }}</span>
          <input
            name="password"
            type="password"
            autocomplete="current-password"
            dir="ltr"
            required
            [(ngModel)]="password"
            [disabled]="busy()"
          />
        </label>

        <button type="submit" class="submit" [disabled]="busy()">
          {{ busy() ? copy.auth.signingIn : copy.auth.signIn }}
        </button>
      </form>
    </main>
  `,
  styles: `
    :host { display: block; }

    .wrap {
      min-block-size: 100vh;
      display: grid;
      place-items: center;
      padding: var(--lf-space-4);
      background: var(--lf-ground);
    }

    .card {
      inline-size: min(400px, 100%);
      background: var(--lf-ground);
      border: 3px solid var(--lf-ink);
      padding: var(--lf-space-8) var(--lf-space-6) var(--lf-space-6);
    }

    .title {
      margin: 0;
      font-weight: 600;
      font-size: 34px;
      line-height: 1;
    }
    .sub {
      margin: var(--lf-space-2) 0 var(--lf-space-6);
      font-size: 14px;
      color: var(--lf-muted);
    }

    .field { display: block; margin-block-end: var(--lf-space-4); }
    .field__label { display: block; margin-block-end: 6px; color: var(--lf-muted); }
    .field input {
      inline-size: 100%;
      min-block-size: var(--lf-touch);
      padding-inline: var(--lf-space-3);
      border: 2px solid var(--lf-ink);
      border-radius: 0;
      background: var(--lf-surface);
      color: var(--lf-ink);
      font: inherit;
    }
    .field input:focus-visible { outline: 3px solid var(--lf-red); outline-offset: 0; }
    .field input:disabled { opacity: 0.6; }

    .submit {
      inline-size: 100%;
      min-block-size: 52px;
      border: 0;
      background: var(--lf-red);
      color: var(--lf-on-red);
      font: inherit;
      font-weight: 600;
      font-size: 17px;
      cursor: pointer;
    }
    .submit:disabled { opacity: 0.7; cursor: default; }
  `,
})
export class SignIn {
  private readonly supabase = inject(SupabaseService);
  private readonly notify = inject(NotifyService);
  private readonly router = inject(Router);

  protected readonly copy = COPY;
  protected email = '';
  protected password = '';
  protected readonly busy = signal(false);

  protected async submit(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.supabase.signIn(this.email.trim(), this.password);
      await this.router.navigate(['/']);
    } catch (error) {
      // Sign-in failures are recoverable by definition — the user tries again.
      this.notify.failed(isAppError(error) ? error.message : COPY.errors.generic);
    } finally {
      this.busy.set(false);
    }
  }
}
