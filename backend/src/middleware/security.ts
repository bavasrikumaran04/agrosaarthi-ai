import cors from 'cors';
import type { RequestHandler } from 'express';
import helmet from 'helmet';
import { Errors } from '../lib/errors.js';

/** Security headers for a JSON API (Swagger UI relaxes CSP on its own route). */
export function securityHeaders(): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'no-referrer' },
    strictTransportSecurity: { maxAge: 15_552_000, includeSubDomains: true },
  });
}

/** CORS restricted to an explicit allowlist of origins; credentials allowed for the refresh cookie. */
export function corsPolicy(allowedOrigins: readonly string[]): RequestHandler {
  const allow = new Set(allowedOrigins);
  return cors({
    origin: (origin, callback) => {
      // Requests without an Origin header (server-to-server, telephony webhooks, curl) are not CORS requests.
      if (!origin) return callback(null, true);
      callback(null, allow.has(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-CSRF-Protection', 'Idempotency-Key'],
    exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
    maxAge: 600,
  });
}

function hasUnsafeKey(value: unknown, depth = 0): boolean {
  if (depth > 32) return true;
  if (Array.isArray(value)) return value.some((v) => hasUnsafeKey(v, depth + 1));
  if (value !== null && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (key.startsWith('$') || key === '__proto__' || key === 'constructor' || key === 'prototype' || key.includes('\u0000')) {
        return true;
      }
      if (hasUnsafeKey((value as Record<string, unknown>)[key], depth + 1)) return true;
    }
  }
  return false;
}

/**
 * Defence in depth against NoSQL operator injection and prototype pollution:
 * reject any request whose body or query contains `$`-prefixed or prototype keys.
 * (Primary protection is the Zod allowlist on every route.)
 */
export function rejectOperatorKeys(): RequestHandler {
  return (req, _res, next) => {
    if (hasUnsafeKey(req.body) || hasUnsafeKey(req.query)) {
      next(Errors.badRequest('Request contains disallowed field names'));
      return;
    }
    next();
  };
}

/**
 * CSRF protection for endpoints authenticated by cookie (token refresh/logout):
 * the Origin, when present, must be allowlisted, and a custom header must be
 * sent. Browsers cannot attach a custom header cross-site without a CORS
 * preflight, which only allowlisted origins pass.
 */
export function requireCsrfHeader(allowedOrigins: readonly string[]): RequestHandler {
  const allow = new Set(allowedOrigins);
  return (req, _res, next) => {
    const origin = req.get('origin');
    if (origin && !allow.has(origin)) {
      next(Errors.forbidden('Request origin is not allowed'));
      return;
    }
    if (req.get('x-csrf-protection') !== '1') {
      next(Errors.forbidden('Missing CSRF protection header'));
      return;
    }
    next();
  };
}

/** Respond 503 if a handler has not produced a response within `ms`. */
export function requestTimeout(ms: number): RequestHandler {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) next(Errors.requestTimeout());
    }, ms);
    const clear = () => clearTimeout(timer);
    res.on('finish', clear);
    res.on('close', clear);
    next();
  };
}
