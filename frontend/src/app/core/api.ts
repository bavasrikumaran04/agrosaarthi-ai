import { HttpClient, HttpErrorResponse, HttpEvent, HttpEventType, HttpParams } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, catchError, filter, map, throwError } from 'rxjs';

export interface AppConfig {
  apiBaseUrl: string;
  environmentName: string;
}
export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');

/** Fetched before bootstrap so one build works in every environment. */
export async function loadAppConfig(): Promise<AppConfig> {
  try {
    const res = await fetch('app-config.json', { cache: 'no-store' });
    if (res.ok) {
      const cfg = (await res.json()) as Partial<AppConfig>;
      return { apiBaseUrl: (cfg.apiBaseUrl ?? '').replace(/\/+$/, ''), environmentName: cfg.environmentName ?? 'unknown' };
    }
  } catch {
    /* fall through to same-origin default */
  }
  return { apiBaseUrl: '', environmentName: 'default' };
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface Envelope<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string; details?: unknown };
  meta?: { requestId?: string; pagination?: Pagination };
}

export type UploadProgress<T> = { kind: 'progress'; percent: number } | { kind: 'done'; data: T };

function toApiError(err: unknown): ApiError {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as Envelope<unknown> | null;
    if (body && typeof body === 'object' && body.error) {
      return new ApiError(err.status, body.error.code, body.error.message, body.error.details, body.meta?.requestId);
    }
    return new ApiError(err.status, err.status === 0 ? 'NETWORK' : 'UNKNOWN', err.message);
  }
  return new ApiError(0, 'UNKNOWN', String(err));
}

/** The only way features talk to the API: prefixes the base URL, unwraps the envelope, normalises errors. */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);

  url(path: string): string {
    return `${this.config.apiBaseUrl}${path}`;
  }

  get<T>(path: string, params?: Record<string, string | number | undefined>): Observable<T> {
    return this.http.get<Envelope<T>>(this.url(path), { params: this.params(params) }).pipe(
      map((r) => r.data),
      catchError((e) => throwError(() => toApiError(e))),
    );
  }

  getPage<T>(path: string, params?: Record<string, string | number | undefined>): Observable<{ items: T[]; pagination: Pagination }> {
    return this.http.get<Envelope<T[]>>(this.url(path), { params: this.params(params) }).pipe(
      map((r) => ({ items: r.data, pagination: r.meta?.pagination ?? { page: 1, pageSize: r.data.length, total: r.data.length, totalPages: 1 } })),
      catchError((e) => throwError(() => toApiError(e))),
    );
  }

  post<T>(path: string, body: unknown = {}, opts: { withCredentials?: boolean; headers?: Record<string, string> } = {}): Observable<T> {
    return this.http.post<Envelope<T> | null>(this.url(path), body, opts).pipe(
      map((r) => (r ? r.data : (undefined as T))),
      catchError((e) => throwError(() => toApiError(e))),
    );
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<Envelope<T>>(this.url(path), body).pipe(
      map((r) => r.data),
      catchError((e) => throwError(() => toApiError(e))),
    );
  }

  upload<T>(path: string, form: FormData): Observable<UploadProgress<T>> {
    return this.http.post<Envelope<T>>(this.url(path), form, { reportProgress: true, observe: 'events' }).pipe(
      filter((e: HttpEvent<Envelope<T>>) => e.type === HttpEventType.UploadProgress || e.type === HttpEventType.Response),
      map((e): UploadProgress<T> => {
        if (e.type === HttpEventType.UploadProgress) return { kind: 'progress', percent: e.total ? Math.round((100 * e.loaded) / e.total) : 0 };
        return { kind: 'done', data: (e as { body: Envelope<T> }).body.data };
      }),
      catchError((err) => throwError(() => toApiError(err))),
    );
  }

  private params(p?: Record<string, string | number | undefined>): HttpParams {
    let hp = new HttpParams();
    for (const [k, v] of Object.entries(p ?? {})) if (v !== undefined && v !== '') hp = hp.set(k, String(v));
    return hp;
  }
}
