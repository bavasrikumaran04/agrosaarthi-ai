import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { Logger } from '../lib/logger.js';

const VALID_INCOMING_ID = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Assign every request an id (honouring a well-formed incoming X-Request-Id),
 * echo it back in the response, and expose it to handlers via res.locals.
 */
export function requestId(): RequestHandler {
  return (req, res, next) => {
    const incoming = req.get('x-request-id');
    const id = incoming && VALID_INCOMING_ID.test(incoming) ? incoming : randomUUID();
    res.locals.requestId = id;
    res.setHeader('X-Request-Id', id);
    next();
  };
}

/**
 * Structured access log. Deliberately logs only method, path (no query string,
 * which may carry signed-URL tokens), status, duration and user id — never
 * bodies, headers, IPs or phone numbers. Requests slower than `slowMs` are
 * logged at warn level for slow-request monitoring.
 */
export function accessLog(logger: Logger, slowMs: number): RequestHandler {
  return (req, res, next) => {
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const path = req.originalUrl.split('?')[0] ?? req.originalUrl;
      if (path === '/api/health/live') return;
      const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
      const entry = {
        requestId: res.locals.requestId as string | undefined,
        method: req.method,
        path,
        status: res.statusCode,
        durationMs: Math.round(durationMs),
        userId: req.auth?.userId,
      };
      if (res.statusCode >= 500) logger.error(entry, 'request failed');
      else if (durationMs > slowMs) logger.warn({ ...entry, slow: true }, 'slow request');
      else if (res.statusCode >= 400) logger.info(entry, 'request rejected');
      else logger.info(entry, 'request completed');
    });
    next();
  };
}
