import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG, ApiClient, ApiError } from './api';
import { AuthService, authInterceptor, roleGuard } from './auth';
import { en } from './i18n/en';
import { I18nService } from './i18n/i18n';
import { ta } from './i18n/ta';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => (typeof v === 'string' ? [`${prefix}${k}`] : keys(v as object, `${prefix}${k}.`)));
}

const session = (over: Record<string, unknown> = {}) => ({
  success: true,
  data: { accessToken: 'tok-1', expiresIn: 900, user: { id: 'u1', name: 'Murugan', role: 'FARMER', preferredLanguage: 'ta', permissions: ['image:analyze'], mustChangePassword: false, ...over } },
  meta: {},
});

describe('core', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
    TestBed.configureTestingModule({
      providers: [
        { provide: APP_CONFIG, useValue: { apiBaseUrl: 'http://api.test', environmentName: 'test' } },
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  describe('i18n', () => {
    it('Tamil has every English key with non-empty text', () => {
      const taKeys = new Set(keys(ta));
      const missing = keys(en).filter((k) => !taKeys.has(k));
      expect(missing).toEqual([]);
      for (const k of keys(ta)) expect(TestBed.inject(I18nService).t(k).length).toBeGreaterThan(0);
    });

    it('defaults to Tamil, switches language, interpolates and sets <html lang>', () => {
      const i18n = TestBed.inject(I18nService);
      expect(i18n.language()).toBe('ta');
      expect(i18n.t('nav.home')).toBe('முகப்பு');
      i18n.setLanguage('en');
      expect(i18n.t('dashboard.title', { name: 'Selvi' })).toBe('Hello, Selvi');
      expect(document.documentElement.lang).toBe('en');
      expect(localStorage.getItem('agrosaarthi.language')).toBe('en');
    });

    it('maps API errors to friendly text and never shows raw server messages', () => {
      const i18n = TestBed.inject(I18nService);
      i18n.setLanguage('en');
      expect(i18n.errorMessage(new ApiError(429, 'RATE_LIMITED', 'raw'))).toBe(en.errors.RATE_LIMITED);
      expect(i18n.errorMessage(new ApiError(0, 'NETWORK', 'x'))).toBe(en.errors.NETWORK);
      expect(i18n.errorMessage(new ApiError(500, 'WEIRD_CODE', 'stack trace here'))).toBe(en.errors.UNKNOWN);
    });
  });

  describe('ApiClient', () => {
    it('unwraps the envelope and pagination, and converts errors', async () => {
      const api = TestBed.inject(ApiClient);
      const p = firstValueFrom(api.getPage<{ id: number }>('/api/v1/cases', { page: 2, q: undefined }));
      const req = http.expectOne('http://api.test/api/v1/cases?page=2');
      req.flush({ success: true, data: [{ id: 1 }], meta: { pagination: { page: 2, pageSize: 20, total: 21, totalPages: 2 } } });
      expect(await p).toEqual({ items: [{ id: 1 }], pagination: { page: 2, pageSize: 20, total: 21, totalPages: 2 } });

      const e = firstValueFrom(api.get('/api/v1/x'));
      http.expectOne('http://api.test/api/v1/x').flush({ success: false, error: { code: 'NOT_FOUND', message: 'nope' }, meta: { requestId: 'r1' } }, { status: 404, statusText: 'Not Found' });
      await expect(e).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND', requestId: 'r1' });
    });
  });

  describe('AuthService + interceptor', () => {
    it('logs in with credentials, keeps the token in memory and sends it only to the API', async () => {
      const auth = TestBed.inject(AuthService);
      const p = auth.login('9876543210', 'secret-pass');
      const req = http.expectOne('http://api.test/api/v1/auth/login');
      expect(req.request.withCredentials).toBe(true);
      req.flush(session());
      expect((await p).name).toBe('Murugan');
      expect(auth.isAuthenticated()).toBe(true);
      expect(localStorage.getItem('tok-1')).toBeNull();

      const client = TestBed.inject(HttpClient);
      firstValueFrom(client.get('http://api.test/api/v1/cases')).catch(() => undefined);
      expect(http.expectOne('http://api.test/api/v1/cases').request.headers.get('Authorization')).toBe('Bearer tok-1');
      firstValueFrom(client.get('https://other.example/data')).catch(() => undefined);
      expect(http.expectOne('https://other.example/data').request.headers.has('Authorization')).toBe(false);
    });

    it('refreshes once on 401 for concurrent requests and retries them', async () => {
      const auth = TestBed.inject(AuthService);
      const login = auth.login('a@b.c', 'pw');
      http.expectOne('http://api.test/api/v1/auth/login').flush(session());
      await login;
      const client = TestBed.inject(HttpClient);
      const r1 = firstValueFrom(client.get('http://api.test/api/v1/a'));
      const r2 = firstValueFrom(client.get('http://api.test/api/v1/b'));
      http.expectOne('http://api.test/api/v1/a').flush({}, { status: 401, statusText: 'x' });
      http.expectOne('http://api.test/api/v1/b').flush({}, { status: 401, statusText: 'x' });
      const refresh = http.match('http://api.test/api/v1/auth/refresh');
      expect(refresh.length).toBe(1);
      expect(refresh[0]!.request.headers.get('X-CSRF-Protection')).toBe('1');
      refresh[0]!.flush({ ...session(), data: { ...session().data, accessToken: 'tok-2' } });
      const retryA = http.expectOne('http://api.test/api/v1/a');
      expect(retryA.request.headers.get('Authorization')).toBe('Bearer tok-2');
      retryA.flush({ ok: 1 });
      http.expectOne('http://api.test/api/v1/b').flush({ ok: 2 });
      expect(await r1).toEqual({ ok: 1 });
      expect(await r2).toEqual({ ok: 2 });
    });

    it('signs out and redirects to login when refresh fails', async () => {
      const auth = TestBed.inject(AuthService);
      const router = TestBed.inject(Router);
      const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      const login = auth.login('a@b.c', 'pw');
      http.expectOne('http://api.test/api/v1/auth/login').flush(session());
      await login;
      const r = firstValueFrom(TestBed.inject(HttpClient).get('http://api.test/api/v1/a'));
      http.expectOne('http://api.test/api/v1/a').flush({}, { status: 401, statusText: 'x' });
      http.expectOne('http://api.test/api/v1/auth/refresh').flush({ success: false, error: { code: 'UNAUTHENTICATED', message: 'x' } }, { status: 401, statusText: 'x' });
      await expect(r).rejects.toBeTruthy();
      expect(auth.isAuthenticated()).toBe(false);
      expect(nav).toHaveBeenCalledWith(['/login'], expect.anything());
    });
  });

  describe('roleGuard', () => {
    const run = (guard: ReturnType<typeof roleGuard>, url = '/x') =>
      TestBed.runInInjectionContext(() => guard({} as never, { url } as never));

    it('redirects anonymous users to login and wrong roles to their home', async () => {
      const router = TestBed.inject(Router);
      expect(router.serializeUrl(run(roleGuard('ADMIN')) as never)).toBe('/login?returnUrl=%2Fx');
      const auth = TestBed.inject(AuthService);
      const login = auth.login('a', 'b');
      http.expectOne('http://api.test/api/v1/auth/login').flush(session());
      await login;
      expect(router.serializeUrl(run(roleGuard('ADMIN')) as never)).toBe('/dashboard');
      expect(run(roleGuard('FARMER'))).toBe(true);
    });

    it('forces a password change before anything else', async () => {
      const auth = TestBed.inject(AuthService);
      const login = auth.login('a', 'b');
      http.expectOne('http://api.test/api/v1/auth/login').flush(session({ role: 'EXPERT', mustChangePassword: true }));
      await login;
      expect(TestBed.inject(Router).serializeUrl(run(roleGuard('EXPERT'), '/expert') as never)).toBe('/account/password');
    });
  });
});
