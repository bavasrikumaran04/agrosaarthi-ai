import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/auth';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/public/home').then((m) => m.HomePage) },
  { path: 'language', loadComponent: () => import('./features/public/language').then((m) => m.LanguagePage) },
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./features/public/auth-pages').then((m) => m.LoginPage) },
  { path: 'register', canActivate: [guestGuard], loadComponent: () => import('./features/public/auth-pages').then((m) => m.RegisterPage) },
  { path: 'account/password', canActivate: [authGuard], loadComponent: () => import('./features/public/auth-pages').then((m) => m.ChangePasswordPage) },
  { path: 'help', data: { page: 'help' }, loadComponent: () => import('./features/public/info').then((m) => m.InfoPage) },
  { path: 'safety', data: { page: 'safety' }, loadComponent: () => import('./features/public/info').then((m) => m.InfoPage) },
  { path: 'privacy', data: { page: 'privacy' }, loadComponent: () => import('./features/public/info').then((m) => m.InfoPage) },
  { path: 'crops', loadComponent: () => import('./features/farmer/crops').then((m) => m.CropsPage) },
  { path: 'crops/:key', loadComponent: () => import('./features/farmer/crops').then((m) => m.CropDetailPage) },

  // Farmer area
  { path: 'dashboard', canActivate: [roleGuard('FARMER')], loadComponent: () => import('./features/farmer/cases').then((m) => m.DashboardPage) },
  { path: 'analyze', canActivate: [roleGuard('FARMER')], loadComponent: () => import('./features/farmer/analyze').then((m) => m.AnalyzePage) },
  { path: 'ask', canActivate: [roleGuard('FARMER')], loadComponent: () => import('./features/farmer/ask').then((m) => m.AskPage) },
  { path: 'cases', canActivate: [roleGuard('FARMER')], loadComponent: () => import('./features/farmer/cases').then((m) => m.CasesPage) },
  { path: 'cases/:id', canActivate: [roleGuard('FARMER')], loadComponent: () => import('./features/farmer/cases').then((m) => m.CaseDetailPage) },

  // Expert desk (administrators can use it too)
  { path: 'expert', canActivate: [roleGuard('EXPERT', 'ADMIN')], loadComponent: () => import('./features/expert/expert').then((m) => m.ExpertDashboardPage) },
  { path: 'expert/cases/:id', canActivate: [roleGuard('EXPERT', 'ADMIN')], loadComponent: () => import('./features/expert/expert').then((m) => m.ExpertCasePage) },

  // Administration
  { path: 'admin', canActivate: [roleGuard('ADMIN')], loadComponent: () => import('./features/admin/admin').then((m) => m.AdminPage) },

  { path: '**', loadComponent: () => import('./features/public/info').then((m) => m.InfoPage) },
];
