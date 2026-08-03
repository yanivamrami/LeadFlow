import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { LucideArrowRight, LucideCheck } from '@lucide/angular';

import { COPY } from '../../core/copy';
import { NotifyService } from '../../core/notify.service';
import { isAppError, SupabaseService } from '../../core/supabase.service';
import { FormError } from '../../shared/form-error';

/**
 * 7.3 — deleting the account, reached only from the profile's last section.
 *
 * It is its own route rather than a dialog on top of the settings, because the two steps
 * have to be genuinely separate: arriving here is the first, and the acknowledgement plus
 * the commit is the second. A confirm modal that appears and can be dismissed by a
 * mis-tap outside it is not a second step.
 *
 * It counts the real rows first. "This will delete your data" is an abstraction someone
 * can agree to without picturing it; "38 leads, 112 activity entries" is not. There is no
 * type-the-name gate — this audience types Hebrew on a phone, and making leaving painful
 * is a punishment, which this product does not do.
 */
@Component({
  selector: 'lf-delete-account',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideArrowRight, LucideCheck, FormError],
  templateUrl: './delete-account.html',
  styleUrl: './delete-account.scss',
})
export class DeleteAccount {
  private readonly supabase = inject(SupabaseService);
  private readonly notify = inject(NotifyService);
  private readonly router = inject(Router);

  protected readonly copy = COPY;

  protected readonly acknowledged = signal(false);
  protected readonly busy = signal(false);
  protected readonly counting = signal(true);
  protected readonly serverProblem = signal<string | null>(null);

  private readonly leads = signal(0);
  private readonly activities = signal(0);
  private readonly reminders = signal(0);

  protected readonly lines = computed(() => [
    COPY.profile.delete.leads(this.leads()),
    COPY.profile.delete.activities(this.activities()),
    COPY.profile.delete.reminders(this.reminders()),
    COPY.profile.delete.account,
  ]);

  constructor() {
    void this.count();
  }

  protected toggle(event: Event): void {
    this.acknowledged.set((event.target as HTMLInputElement).checked);
  }

  private async count(): Promise<void> {
    try {
      const [leads, activities, reminders] = await Promise.all([
        this.supabase.countRows('leads'),
        this.supabase.countRows('activities'),
        this.supabase.countRows('reminders'),
      ]);
      this.leads.set(leads);
      this.activities.set(activities);
      this.reminders.set(reminders);
    } catch {
      // A failed count must not block the delete — someone who wants out gets out. The
      // zeroes it falls back to are honest about what is known, not a claim of emptiness.
    } finally {
      this.counting.set(false);
    }
  }

  protected async submit(): Promise<void> {
    if (!this.acknowledged() || this.busy()) return;

    this.serverProblem.set(null);
    this.busy.set(true);
    try {
      await this.supabase.deleteAccount();
      await this.router.navigateByUrl('/auth/sign-in');
      this.notify.succeeded(COPY.profile.delete.done);
    } catch (error) {
      this.serverProblem.set(isAppError(error) ? error.message : COPY.errors.deleteFailed);
    } finally {
      this.busy.set(false);
    }
  }
}
