import { z } from 'zod';
import { defineSection, envBool, envPositiveInt, envSecret } from '../helpers.js';

export const authSection = defineSection({
  name: 'auth',
  schema: z.object({
    JWT_ACCESS_SECRET: envSecret(32),
    JWT_ACCESS_TTL_SECONDS: envPositiveInt.max(3600).default(900),
    JWT_ISSUER: z.string().default('agrosaarthi-api'),
    JWT_AUDIENCE: z.string().default('agrosaarthi-web'),
    REFRESH_TOKEN_TTL_DAYS: envPositiveInt.max(90).default(7),
    COOKIE_SECURE: envBool.optional(),
    /** Use "none" only when the frontend and API are on different sites (requires COOKIE_SECURE=true). */
    COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    COOKIE_DOMAIN: z.string().optional(),
    PASSWORD_MIN_LENGTH: envPositiveInt.min(8).max(64).default(8),
    LOGIN_MAX_FAILED_ATTEMPTS: envPositiveInt.default(5),
    LOGIN_LOCKOUT_MINUTES: envPositiveInt.default(15),
    /** argon2id memory cost in KiB (OWASP minimum guidance: 19456 KiB with t=2, p=1). */
    PASSWORD_HASH_MEMORY_KIB: envPositiveInt.min(1024).default(19_456),
    PASSWORD_HASH_TIME_COST: envPositiveInt.default(2),
  }),
  map: (e, ctx) => ({
    accessSecret: e.JWT_ACCESS_SECRET,
    accessTtlSeconds: e.JWT_ACCESS_TTL_SECONDS,
    issuer: e.JWT_ISSUER,
    audience: e.JWT_AUDIENCE,
    refreshTtlDays: e.REFRESH_TOKEN_TTL_DAYS,
    cookieSecure: e.COOKIE_SECURE ?? ctx.isProduction,
    cookieSameSite: e.COOKIE_SAMESITE,
    cookieDomain: e.COOKIE_DOMAIN,
    passwordMinLength: e.PASSWORD_MIN_LENGTH,
    loginMaxFailedAttempts: e.LOGIN_MAX_FAILED_ATTEMPTS,
    loginLockoutMinutes: e.LOGIN_LOCKOUT_MINUTES,
    passwordHashMemoryKiB: e.PASSWORD_HASH_MEMORY_KIB,
    passwordHashTimeCost: e.PASSWORD_HASH_TIME_COST,
  }),
  validate: (c, ctx) => {
    const issues: string[] = [];
    if (c.cookieSameSite === 'none' && !c.cookieSecure) issues.push('COOKIE_SAMESITE=none requires COOKIE_SECURE=true');
    if (ctx.isProduction) {
      if (!c.cookieSecure) issues.push('COOKIE_SECURE must be true in production');
      if (c.passwordHashMemoryKiB < 19_456) issues.push('PASSWORD_HASH_MEMORY_KIB must be >= 19456 in production');
    }
    return issues;
  },
});

export type AuthConfig = ReturnType<typeof authSection.map>;
