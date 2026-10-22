import mongoose from 'mongoose';
import type { DatabaseConfig } from '../config/sections/database.js';
import { serializeError, type Logger } from '../lib/logger.js';
import { withTimeout } from '../lib/resilience.js';

mongoose.set('strictQuery', true);

let listenersAttached = false;

function attachListeners(logger: Logger): void {
  if (listenersAttached) return;
  listenersAttached = true;
  const conn = mongoose.connection;
  conn.on('connected', () => logger.info('mongodb connected'));
  conn.on('reconnected', () => logger.warn('mongodb reconnected'));
  conn.on('disconnected', () => logger.warn('mongodb disconnected'));
  conn.on('error', (err: unknown) => logger.error({ err: serializeError(err) }, 'mongodb connection error'));
}

/**
 * Connect with a bounded number of attempts so a deployment with a wrong URI
 * fails fast instead of hanging. The driver handles reconnection afterwards.
 */
export async function connectDatabase(config: DatabaseConfig, logger: Logger, attempts = 3): Promise<void> {
  attachListeners(logger);
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await mongoose.connect(config.uri, {
        maxPoolSize: config.maxPoolSize,
        serverSelectionTimeoutMS: config.serverSelectionTimeoutMs,
        autoIndex: config.autoIndex,
      });
      return;
    } catch (err) {
      lastError = err;
      logger.error({ attempt, attempts, err: serializeError(err) }, 'mongodb connection attempt failed');
      if (attempt < attempts) await new Promise((r) => setTimeout(r, 1_000 * attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('MongoDB connection failed');
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export type DatabaseState = 'disconnected' | 'connected' | 'connecting' | 'disconnecting' | 'unknown';

export function databaseState(): DatabaseState {
  switch (mongoose.connection.readyState) {
    case 0:
      return 'disconnected';
    case 1:
      return 'connected';
    case 2:
      return 'connecting';
    case 3:
      return 'disconnecting';
    default:
      return 'unknown';
  }
}

/** Readiness probe: a real round trip to the server, bounded by a timeout. */
export async function pingDatabase(timeoutMs = 2_000): Promise<{ ok: boolean; latencyMs?: number }> {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) return { ok: false };
  const started = Date.now();
  try {
    await withTimeout(() => mongoose.connection.db!.admin().ping(), timeoutMs, 'mongodb ping');
    return { ok: true, latencyMs: Date.now() - started };
  } catch {
    return { ok: false };
  }
}
