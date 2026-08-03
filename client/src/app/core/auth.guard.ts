import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

import { SupabaseService } from './supabase.service';

/**
 * The two doors. Both wait on `whenReady` first: a guard that decides before the stored
 * session has been restored will bounce a signed-in user to the sign-in screen on every
 * cold load, which is the single most common way this goes wrong.
 *
 * Neither guard is authorization. Nothing here protects data — RLS does that on the
 * server. These only decide which screen is the right one to be looking at.
 */

export const authGuard: CanActivateFn = async (_route, state): Promise<boolean | UrlTree> => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  await supabase.whenReady;
  if (supabase.isAuthenticated()) return true;

  // Carry where they were headed, so signing in resumes it instead of dumping
  // everyone on the board.
  return router.createUrlTree(['/auth/sign-in'], {
    queryParams: state.url && state.url !== '/' ? { returnUrl: state.url } : undefined,
  });
};

/** Keeps a signed-in user off sign-in / sign-up / reset-request. */
export const guestGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  await supabase.whenReady;

  // A recovery link mints a real session before the new password is chosen. That user
  // is "signed in" but is not done — let them through to finish.
  if (supabase.isAuthenticated() && !supabase.inRecovery()) return router.createUrlTree(['/']);
  return true;
};
