import cookieParser from 'cookie-parser';
import express, { type Express, type Router } from 'express';
import type { AppConfig } from './config/index.js';
import type { Logger } from './lib/logger.js';
import type { AuthMiddleware } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { createRateLimiter } from './middleware/rate-limit.js';
import { accessLog, requestId } from './middleware/request-context.js';
import { corsPolicy, rejectOperatorKeys, requestTimeout, securityHeaders } from './middleware/security.js';

export interface MountedRouter {
  path: string;
  router: Router;
}

export interface CreateAppOptions {
  config: AppConfig;
  logger: Logger;
  auth: AuthMiddleware;
  /** Regular JSON API routers (mounted after body parsing and bearer authentication). */
  routes: MountedRouter[];
  /**
   * Provider webhooks (telephony). Mounted BEFORE JSON parsing and bearer
   * authentication: they parse their own bodies and verify provider signatures.
   */
  webhooks?: MountedRouter[];
  /** Routers that must bypass the global rate limiter (health probes). */
  unthrottled?: MountedRouter[];
}

export function createApp(opts: CreateAppOptions): Express {
  const { config, logger } = opts;
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.core.trustProxy);
  app.set('query parser', 'simple');

  app.use(requestId());
  app.use(accessLog(logger, config.core.slowRequestMs));
  app.use(securityHeaders());
  app.use(corsPolicy(config.core.frontendOrigins));
  app.use(requestTimeout(config.core.requestTimeoutMs));

  for (const m of opts.unthrottled ?? []) app.use(m.path, m.router);
  for (const m of opts.webhooks ?? []) app.use(m.path, m.router);

  app.use(
    createRateLimiter({
      name: 'global',
      windowMs: config.security.rateLimitWindowMs,
      limit: config.security.rateLimitMax,
    }),
  );
  app.use(express.json({ limit: config.core.jsonBodyLimit, strict: true }));
  app.use(cookieParser());
  app.use(rejectOperatorKeys());
  app.use(opts.auth.authenticate);

  for (const m of opts.routes) app.use(m.path, m.router);

  app.use(notFoundHandler());
  app.use(errorHandler(logger));
  return app;
}
