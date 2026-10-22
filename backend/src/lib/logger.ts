import { pino, type Logger, type LoggerOptions } from 'pino';

export type { Logger } from 'pino';

/**
 * Paths removed from every log line. We never log request bodies at all, but
 * service code sometimes logs objects — these keys are censored wherever they
 * appear one level deep.
 */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-twilio-signature"]',
  'req.headers["x-simulator-signature"]',
  'req.headers["x-model-service-token"]',
  'res.headers["set-cookie"]',
  'headers.authorization',
  'headers.cookie',
  '*.password',
  '*.newPassword',
  '*.currentPassword',
  '*.passwordHash',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.apiKey',
  '*.secret',
  '*.authorization',
  '*.cookie',
  '*.phone',
  '*.phoneNumber',
  '*.phoneEncrypted',
  '*.from',
  '*.to',
  '*.caller',
  '*.transcript',
  '*.text',
  '*.question',
];

export interface LoggerSettings {
  level: string;
  pretty: boolean;
  name?: string;
}

export function createLogger(settings: LoggerSettings): Logger {
  const options: LoggerOptions = {
    name: settings.name ?? 'agrosaarthi-api',
    level: settings.level,
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    base: { service: settings.name ?? 'agrosaarthi-api' },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label) => ({ level: label }) },
  };
  if (settings.pretty) {
    // pino-pretty is a dev dependency; only used when explicitly enabled (development).
    return pino({ ...options, transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } } });
  }
  return pino(options);
}

/** A logger that discards everything (unit tests). */
export function createSilentLogger(): Logger {
  return pino({ level: 'silent' });
}

/**
 * Reduce an error to log-safe fields. Provider SDK errors can embed request
 * payloads or URLs with keys; we keep only name/message/code/status and stack.
 */
export function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    const anyErr = err as Error & { code?: unknown; status?: unknown; statusCode?: unknown };
    return {
      name: err.name,
      message: err.message.slice(0, 500),
      code: typeof anyErr.code === 'string' || typeof anyErr.code === 'number' ? anyErr.code : undefined,
      status: typeof anyErr.status === 'number' ? anyErr.status : typeof anyErr.statusCode === 'number' ? anyErr.statusCode : undefined,
      stack: err.stack?.split('\n').slice(0, 8).join('\n'),
    };
  }
  return { message: String(err).slice(0, 500) };
}
