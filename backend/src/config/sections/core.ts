import { z } from 'zod';
import { defineSection, envBool, envList, envNonNegativeInt, envPort, envPositiveInt, isHttpsUrl, isLocalhostUrl } from '../helpers.js';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

function isOrigin(value: string): boolean {
  try {
    const u = new URL(value);
    return (u.protocol === 'http:' || u.protocol === 'https:') && (u.pathname === '/' || u.pathname === '') && !u.search && !u.hash;
  } catch {
    return false;
  }
}

export const coreSection = defineSection({
  name: 'core',
  schema: z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: envPort.default(4000),
    HOST: z.string().default('0.0.0.0'),
    /** Public HTTPS base URL of this API (used for webhook signature checks and signed file URLs). */
    PUBLIC_BASE_URL: z.url().optional(),
    /** Explicit CORS allowlist, comma separated origins (scheme://host[:port]). */
    FRONTEND_ORIGINS: envList.default(['http://localhost:4200']),
    /** Number of reverse-proxy hops to trust for client IPs (Render/Heroku-style platforms: 1). */
    TRUST_PROXY: envNonNegativeInt.default(0),
    LOG_LEVEL: z.enum(LOG_LEVELS).optional(),
    LOG_PRETTY: envBool.optional(),
    REQUEST_TIMEOUT_MS: envPositiveInt.default(30_000),
    SLOW_REQUEST_MS: envPositiveInt.default(3_000),
    JSON_BODY_LIMIT: z.string().regex(/^\d+(kb|mb)$/i, 'use a size like 100kb or 1mb').default('100kb'),
    SHUTDOWN_GRACE_MS: envPositiveInt.default(10_000),
    /** Serve Swagger UI at /api/docs (OpenAPI JSON is always available at /api/openapi.json). */
    API_DOCS_ENABLED: envBool.optional(),
  }),
  map: (e, ctx) => ({
    nodeEnv: e.NODE_ENV,
    isProduction: ctx.isProduction,
    isTest: e.NODE_ENV === 'test',
    port: e.PORT,
    host: e.HOST,
    publicBaseUrl: (e.PUBLIC_BASE_URL ?? `http://localhost:${e.PORT}`).replace(/\/+$/, ''),
    publicBaseUrlExplicit: e.PUBLIC_BASE_URL !== undefined,
    frontendOrigins: e.FRONTEND_ORIGINS.map((o) => o.replace(/\/+$/, '')),
    trustProxy: e.TRUST_PROXY,
    logLevel: e.LOG_LEVEL ?? (e.NODE_ENV === 'test' ? 'silent' : 'info'),
    logPretty: e.LOG_PRETTY ?? e.NODE_ENV === 'development',
    requestTimeoutMs: e.REQUEST_TIMEOUT_MS,
    slowRequestMs: e.SLOW_REQUEST_MS,
    jsonBodyLimit: e.JSON_BODY_LIMIT.toLowerCase(),
    shutdownGraceMs: e.SHUTDOWN_GRACE_MS,
    apiDocsEnabled: e.API_DOCS_ENABLED ?? !ctx.isProduction,
  }),
  validate: (c, ctx) => {
    const issues: string[] = [];
    for (const origin of c.frontendOrigins) {
      if (!isOrigin(origin)) issues.push(`FRONTEND_ORIGINS: "${origin}" is not a valid origin (expected scheme://host[:port])`);
    }
    if (ctx.isProduction) {
      if (!c.publicBaseUrlExplicit) issues.push('PUBLIC_BASE_URL is required in production');
      else if (!isHttpsUrl(c.publicBaseUrl)) issues.push('PUBLIC_BASE_URL must use https in production');
      for (const origin of c.frontendOrigins) {
        if (!isHttpsUrl(origin) || isLocalhostUrl(origin)) {
          issues.push(`FRONTEND_ORIGINS: "${origin}" must be a non-localhost https origin in production`);
        }
      }
      if (c.logLevel === 'debug' || c.logLevel === 'trace') {
        issues.push('LOG_LEVEL debug/trace is not allowed in production (risk of logging sensitive data)');
      }
    }
    return issues;
  },
});

export type CoreConfig = ReturnType<typeof coreSection.map>;
