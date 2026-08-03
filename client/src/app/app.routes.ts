import { Routes } from '@angular/router';

import { authGuard } from './core/auth.guard';

/**
 * Two worlds. `/auth/*` is signed-out and bare; everything else renders inside `Shell`
 * behind `authGuard`, so the masthead and tabs exist exactly where a session does.
 *
 * The signed-out routes were at `/sign-in`; they are now under `/auth/` so the whole
 * signed-out world is one lazy chunk and one guard, and so a recovery link has somewhere
 * to land (`/auth/reset/new`) that never collides with a feature route.
 */
export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/shell/shell').then((m) => m.Shell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'לוח לידים · LeadFlow Manager',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'profile',
        pathMatch: 'full',
        title: 'פרופיל · LeadFlow Manager',
        loadComponent: () => import('./features/profile/profile').then((m) => m.Profile),
      },
      {
        path: 'profile/delete',
        title: 'מחיקת החשבון · LeadFlow Manager',
        loadComponent: () =>
          import('./features/profile/delete-account').then((m) => m.DeleteAccount),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
