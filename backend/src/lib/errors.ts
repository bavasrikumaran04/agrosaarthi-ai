/**
 * Application error model. Every error that reaches the client is an AppError
 * with a stable machine-readable code and a user-safe message. Internal causes
 * (provider errors, stack traces) are logged but never returned.
 */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'BAD_REQUEST',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'INVALID_STATE_TRANSITION',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'UNPROCESSABLE_ENTITY',
  'RATE_LIMITED',
  'QUOTA_EXCEEDED',
  'ACCOUNT_LOCKED',
  'SERVICE_NOT_CONFIGURED',
  'SERVICE_UNAVAILABLE',
  'UPSTREAM_TIMEOUT',
  'UPSTREAM_ERROR',
  'WEBHOOK_SIGNATURE_INVALID',
  'REQUEST_TIMEOUT',
  'INTERNAL_ERROR',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ErrorDetail {
  path?: string;
  message: string;
  [key: string]: unknown;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: ErrorDetail[] | Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    status: number,
    details?: ErrorDetail[] | Record<string, unknown>,
    options?: { cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const Errors = {
  validation: (details: ErrorDetail[]) => new AppError('VALIDATION_ERROR', 'Request validation failed', 400, details),
  badRequest: (message: string, details?: ErrorDetail[] | Record<string, unknown>) =>
    new AppError('BAD_REQUEST', message, 400, details),
  unauthenticated: (message = 'Authentication required') => new AppError('UNAUTHENTICATED', message, 401),
  forbidden: (message = 'You do not have permission to perform this action') => new AppError('FORBIDDEN', message, 403),
  notFound: (resource = 'Resource') => new AppError('NOT_FOUND', `${resource} not found`, 404),
  conflict: (message: string, details?: Record<string, unknown>) => new AppError('CONFLICT', message, 409, details),
  invalidTransition: (entity: string, from: string, to: string) =>
    new AppError('INVALID_STATE_TRANSITION', `${entity} cannot move from ${from} to ${to}`, 409, { from, to }),
  payloadTooLarge: (message = 'Uploaded content is too large') => new AppError('PAYLOAD_TOO_LARGE', message, 413),
  unsupportedMediaType: (message = 'Unsupported file type') => new AppError('UNSUPPORTED_MEDIA_TYPE', message, 415),
  unprocessable: (message: string, details?: ErrorDetail[] | Record<string, unknown>) =>
    new AppError('UNPROCESSABLE_ENTITY', message, 422, details),
  rateLimited: (message = 'Too many requests, please try again later') => new AppError('RATE_LIMITED', message, 429),
  quotaExceeded: (message = 'Daily usage limit reached, please try again tomorrow') =>
    new AppError('QUOTA_EXCEEDED', message, 429),
  accountLocked: () =>
    new AppError('ACCOUNT_LOCKED', 'Too many failed sign-in attempts. Please wait and try again.', 423),
  serviceNotConfigured: (service: string) =>
    new AppError('SERVICE_NOT_CONFIGURED', `${service} is not configured on this server`, 503, { service }),
  serviceUnavailable: (service: string, options?: { cause?: unknown }) =>
    new AppError('SERVICE_UNAVAILABLE', `${service} is temporarily unavailable`, 503, { service }, options),
  upstreamTimeout: (service: string, options?: { cause?: unknown }) =>
    new AppError('UPSTREAM_TIMEOUT', `${service} did not respond in time`, 504, { service }, options),
  upstreamError: (service: string, options?: { cause?: unknown }) =>
    new AppError('UPSTREAM_ERROR', `${service} returned an unexpected error`, 502, { service }, options),
  webhookSignatureInvalid: () => new AppError('WEBHOOK_SIGNATURE_INVALID', 'Webhook signature verification failed', 403),
  requestTimeout: () => new AppError('REQUEST_TIMEOUT', 'The request took too long to process', 503),
  internal: (options?: { cause?: unknown }) =>
    new AppError('INTERNAL_ERROR', 'An unexpected error occurred', 500, undefined, options),
};

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
