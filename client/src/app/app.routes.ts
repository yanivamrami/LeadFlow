import { Routes } from '@angular/router';

import { authGuard } from './core/auth.guard';

/**
 * Two trees: the signed-out screens, which carry no shell, and everything else, which
 * renders inside it and behind `authGuard`.
 *
 * The guard is a routing decision, not a security boundary — RLS on `tenant_id` is the
 * only thing standing between a user and another tenant's data.
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
