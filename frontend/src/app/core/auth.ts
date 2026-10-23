import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Observable, catchError, finalize, firstValueFrom, map, shareReplay, switchMap, throwError } from 'rxjs';
import { APP_CONFIG, ApiClient } from './api';

export type Role = 'FARMER' | 'EXPERT' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  role: Role;
  email?: string;
  phoneMasked?: string;
  preferredLanguage: string;
  district?: string;
  permissions: string[];
  mustChangePassword: boolean;
}

interface Session {
  accessToken: string;
  expiresIn: number;
  user: User;
}

export interface RegisterInput {
  name: string;
  phone: string;
  password: string;
  preferredLanguage: string;
  district?: string;
  state?: string;
}

/** Must match the backend PRIVACY_NOTICE_VERSION. */
export const PRIVACY_NOTICE_VERSION = '2026-10-22';
const CSRF = { 'X-CSRF-Protection': '1' };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClient);
  private readonly router = inject(Router);
  private readonly _user = signal<User | null>(null);
  /** Access token lives only in memory; the refresh token is an HttpOnly cookie. */
  private accessToken: string | null = null;
  private refreshInFlight: Observable<string> | null = null;

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly role = computed(() => this._user()?.role ?? null);

  token(): string | null {
    return this.accessToken;
  }

  hasPermission(p: string): boolean {
    return this._user()?.permissions.includes(p) ?? false;
  }

  login(identifier: string, password: string): Promise<User> {
    return firstValueFrom(this.api.post<Session>('/api/v1/auth/login', { identifier, password }, { withCredentials: true }).pipe(map((s) => this.apply(s))));
  }

  register(input: RegisterInput): Promise<User> {
    const body = { ...input, consent: { acceptPrivacyNotice: true, aiProcessing: true, privacyNoticeVersion: PRIVACY_NOTICE_VERSION } };
    return firstValueFrom(this.api.post<Session>('/api/v1/auth/register', body, { withCredentials: true }).pipe(map((s) => this.apply(s))));
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await firstValueFrom(this.api.post<Session>('/api/v1/auth/change-password', { currentPassword, newPassword }, { withCredentials: true }).pipe(map((s) => this.apply(s))));
  }

  async updateLanguage(code: string): Promise<void> {
    if (!this._user()) return;
    const user = await firstValueFrom(this.api.patch<User>('/api/v1/auth/me', { preferredLanguage: code }));
    this._user.set(user);
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.api.post('/api/v1/auth/logout', {}, { withCredentials: true, headers: CSRF }));
    } catch {
      /* the local session is cleared regardless */
    }
    this.clear();
    await this.router.navigateByUrl('/');
  }

  /** Single-flight refresh: concurrent 401s share one refresh request. */
  refresh(): Observable<string> {
    this.refreshInFlight ??= this.api.post<Session>('/api/v1/auth/refresh', {}, { withCredentials: true, headers: CSRF }).pipe(
      map((s) => {
        this.apply(s);
        return s.accessToken;
      }),
      finalize(() => (this.refreshInFlight = null)),
      shareReplay(1),
    );
    return this.refreshInFlight;
  }

  /** Called once at startup: restores a session from the refresh cookie if there is one. */
  async restoreSession(): Promise<void> {
    try {
      await firstValueFrom(this.refresh());
    } catch {
      this.clear();
    }
  }

  clear(): void {
    this.accessToken = null;
    this._user.set(null);
  }

  homeFor(user: User | null = this._user()): string {
    if (!user) return '/';
    if (user.mustChangePassword) return '/account/password';
    return user.role === 'ADMIN' ? '/admin' : user.role === 'EXPERT' ? '/expert' : '/dashboard';
  }

  private apply(s: Session): User {
    this.accessToken = s.accessToken;
    this._user.set(s.user);
    return s.user;
  }
}

function isAuthEndpoint(req: HttpRequest<unknown>): boolean {
  return /\/api\/v1\/auth\/(login|register|refresh|logout)$/.test(req.url);
}

/** Adds the bearer token only for our API; on 401 refreshes once and retries. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const config = inject(APP_CONFIG);
  const router = inject(Router);
  const ours = config.apiBaseUrl ? req.url.startsWith(config.apiBaseUrl) : req.url.startsWith('/api/');
  if (!ours) return next(req);
  const withToken = (r: HttpRequest<unknown>, token: string | null) => (token ? r.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : r);

  return next(withToken(req, auth.token())).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401 || isAuthEndpoint(req) || !auth.token()) return throwError(() => err);
      return auth.refresh().pipe(
        switchMap((token) => next(withToken(req, token))),
        catchError((refreshErr: unknown) => {
          auth.clear();
          void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};

/** Navigation guards — they improve UX only; the API enforces authorisation. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.isAuthenticated()) return true;
  return inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() ? inject(Router).parseUrl(auth.homeFor()) : true;
};

export function roleGuard(...roles: Role[]): CanActivateFn {
  return (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const user = auth.user();
    if (!user) return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
    if (user.mustChangePassword && !state.url.startsWith('/account/password')) return router.parseUrl('/account/password');
    return roles.includes(user.role) ? true : router.parseUrl(auth.homeFor(user));
  };
}

