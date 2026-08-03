import { Routes } from '@angular/router';

import { guestGuard } from '../../core/auth.guard';

/**
 * The signed-out routes.
 *
 * `reset/new` is deliberately outside `guestGuard`: a recovery link mints a real session
 * before the new password is chosen, so the guard would bounce the one person who has to
 * be here straight back to the board.
 */
export const authRoutes: Routes = [
  {
    path: 'sign-in',
    title: 'כניסה · LeadFlow Manager',
    canActivate: [guestGuard],
    loadComponent: () => import('./sign-in').then((m) => m.SignIn),
  },
  {
    path: 'sign-up',
    title: 'פתיחת חשבון · LeadFlow Manager',
    canActivate: [guestGuard],
    loadComponent: () => import('./sign-up').then((m) => m.SignUp),
  },
  {
    path: 'reset',
    pathMatch: 'full',
    title: 'איפוס סיסמה · LeadFlow Manager',
    canActivate: [guestGuard],
    loadComponent: () => import('./reset-request').then((m) => m.ResetRequest),
  },
  {
    path: 'reset/new',
    title: 'סיסמה חדשה · LeadFlow Manager',
    loadComponent: () => import('./reset-new').then((m) => m.ResetNew),
  },
  { path: '', pathMatch: 'full', redirectTo: 'sign-in' },
];
