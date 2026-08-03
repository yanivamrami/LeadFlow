import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { SupabaseService } from './supabase.service';

/**
 * Waits for the stored session to be restored before deciding. Without the wait a
 * refresh bounces an authenticated user to sign-in, because `onAuthStateChange` has
 * not fired yet when the route resolves.
 */
export const authGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  await whenReady(supabase);

  return supabase.isAuthenticated() ? true : router.createUrlTree(['/sign-in']);
};

/** Mirror of authGuard for the sign-in route: a signed-in user has no business there. */
export const guestGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  await whenReady(supabase);

  return supabase.isAuthenticated() ? router.createUrlTree(['/']) : true;
};

function whenReady(supabase: SupabaseService): Promise<void> {
  if (supabase.ready()) return Promise.resolve();

  return new Promise((resolve) => {
    // Poll rather than effect(): guards run outside an injection context that would
    // keep an effect alive, and the wait is one tick in practice.
    const started = Date.now();
    const tick = () => {
      if (supabase.ready() || Date.now() - started > 5000) resolve();
      else setTimeout(tick, 25);
    };
    tick();
  });
}
