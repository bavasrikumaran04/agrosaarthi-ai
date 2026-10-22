import type { Request, RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { sendError } from '../lib/http.js';

export interface RateLimitOptions {
  /** Distinguishes counters of different limiters. */
  name: string;
  windowMs: number;
  limit: number;
  /** 'user' keys by authenticated user id (falling back to IP); 'ip' keys by client IP. */
  keyBy?: 'ip' | 'user';
  message?: string;
}

function clientKey(req: Request): string {
  return ipKeyGenerator(req.ip ?? 'unknown');
}

/**
 * In-memory rate limiter (per process). For multi-instance deployments use a
 * shared store (documented in docs/DEPLOYMENT.md); a single small instance is
 * the expected prototype deployment.
 */
export function createRateLimiter(opts: RateLimitOptions): RequestHandler {
  return rateLimit({
    windowMs: opts.windowMs,
    limit: opts.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    identifier: opts.name,
    keyGenerator: (req) => {
      const base = opts.keyBy === 'user' && req.auth ? `u:${req.auth.userId}` : `ip:${clientKey(req)}`;
      return `${opts.name}:${base}`;
    },
    handler: (_req, res) => {
      sendError(res, 429, 'RATE_LIMITED', opts.message ?? 'Too many requests, please try again later');
    },
  });
}
