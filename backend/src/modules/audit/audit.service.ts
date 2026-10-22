import type { Request } from 'express';
import { Types } from 'mongoose';
import { AuditLogModel } from '../../db/models/audit-log.model.js';
import { addDays, type Clock } from '../../lib/clock.js';
import { serializeError, type Logger } from '../../lib/logger.js';
import type { AuditOutcome, Role } from '../../shared/constants.js';

export type AuditActor =
  | { type: 'USER'; userId: string; role: Role }
  | { type: 'SYSTEM' }
  | { type: 'PROVIDER'; name: string };

export interface AuditEntry {
  actor: AuditActor;
  action: string;
  targetType?: string;
  targetId?: string;
  outcome?: AuditOutcome;
  requestId?: string;
  details?: Record<string, unknown>;
}

export interface AuditService {
  record(entry: AuditEntry): Promise<void>;
  /** Convenience: actor + requestId taken from an authenticated request. */
  recordFromRequest(req: Request, entry: Omit<AuditEntry, 'actor' | 'requestId'>): Promise<void>;
}

const SENSITIVE_KEY = /pass|secret|token|key|cookie|authorization|phone|email|otp|transcript|text|body|audio|image|url/i;
const MAX_STRING = 200;

/** Keep audit details small and free of personal data or secrets. */
export function sanitizeAuditDetails(value: unknown, depth = 0): unknown {
  if (depth > 3) return '[truncated]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Types.ObjectId) return value.toHexString();
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitizeAuditDetails(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 30)) {
      out[k] = SENSITIVE_KEY.test(k) ? '[REDACTED]' : sanitizeAuditDetails(v, depth + 1);
    }
    return out;
  }
  return String(value).slice(0, MAX_STRING);
}

export function createAuditService(deps: { logger: Logger; clock: Clock; retentionDays: number }): AuditService {
  const record = async (entry: AuditEntry): Promise<void> => {
    try {
      await AuditLogModel.create({
        actorType: entry.actor.type,
        actorUserId: entry.actor.type === 'USER' ? entry.actor.userId : undefined,
        actorRole: entry.actor.type === 'USER' ? entry.actor.role : undefined,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        outcome: entry.outcome ?? 'SUCCESS',
        requestId: entry.requestId,
        details: entry.details
          ? {
              ...(sanitizeAuditDetails(entry.details) as Record<string, unknown>),
              ...(entry.actor.type === 'PROVIDER' ? { provider: entry.actor.name } : {}),
            }
          : entry.actor.type === 'PROVIDER'
            ? { provider: entry.actor.name }
            : undefined,
        expiresAt: addDays(deps.clock.now(), deps.retentionDays),
      });
    } catch (err) {
      // Auditing must not break the user's request, but a failure is never silent.
      deps.logger.error({ err: serializeError(err), action: entry.action }, 'failed to write audit log entry');
    }
  };

  return {
    record,
    recordFromRequest: (req, entry) =>
      record({
        ...entry,
        actor: req.auth ? { type: 'USER', userId: req.auth.userId, role: req.auth.role } : { type: 'SYSTEM' },
        requestId: typeof req.res?.locals.requestId === 'string' ? req.res.locals.requestId : undefined,
      }),
  };
}
