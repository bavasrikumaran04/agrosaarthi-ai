import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { AppError, Errors, type ErrorDetail } from '../lib/errors.js';
import { sendError } from '../lib/http.js';
import { serializeError, type Logger } from '../lib/logger.js';
import { CircuitOpenError, ConcurrencyLimitError, TimeoutError } from '../lib/resilience.js';

export function notFoundHandler(): RequestHandler {
  return (req, _res, next) => {
    next(new AppError('NOT_FOUND', `Route ${req.method} ${req.path} not found`, 404));
  };
}

interface BodyParserError extends Error {
  type?: string;
  status?: number;
}

/** Translate known library errors into AppErrors with user-safe messages. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  const bp = err as BodyParserError;
  if (bp && typeof bp === 'object' && typeof bp.type === 'string') {
    if (bp.type === 'entity.parse.failed') return Errors.badRequest('Malformed JSON request body');
    if (bp.type === 'entity.too.large') return Errors.payloadTooLarge('Request body is too large');
    if (bp.type === 'encoding.unsupported' || bp.type === 'charset.unsupported') {
      return Errors.unsupportedMediaType('Unsupported request encoding');
    }
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return Errors.payloadTooLarge('Uploaded file is too large');
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      return Errors.badRequest('Unexpected or too many files in upload');
    }
    return Errors.badRequest('Invalid multipart upload');
  }

  if (err instanceof mongoose.Error.CastError) return Errors.badRequest('Invalid identifier or value');
  if (err instanceof mongoose.Error.ValidationError) {
    const details: ErrorDetail[] = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
    return Errors.validation(details);
  }
  const mongoErr = err as { name?: string; code?: number };
  if (mongoErr && (mongoErr.name === 'MongoServerError' || mongoErr.name === 'MongoBulkWriteError') && mongoErr.code === 11000) {
    return Errors.conflict('A record with the same unique value already exists');
  }
  if (err instanceof mongoose.Error.MongooseServerSelectionError || (mongoErr && mongoErr.name === 'MongoNetworkError')) {
    return Errors.serviceUnavailable('Database', { cause: err });
  }

  if (err instanceof TimeoutError) return Errors.upstreamTimeout('A dependent service', { cause: err });
  if (err instanceof CircuitOpenError) return Errors.serviceUnavailable('A dependent service', { cause: err });
  if (err instanceof ConcurrencyLimitError) return Errors.serviceUnavailable('The service is busy; please retry shortly', { cause: err });

  return Errors.internal({ cause: err });
}

/**
 * Central error handler. Clients get { success:false, error:{code,message,details} };
 * stack traces and provider messages are only logged, never returned.
 */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, req, res, _next) => {
    const appErr = toAppError(err);
    const logEntry = {
      requestId: res.locals.requestId as string | undefined,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      code: appErr.code,
      status: appErr.status,
    };
    if (appErr.status >= 500) {
      logger.error({ ...logEntry, err: serializeError(err), cause: appErr.cause ? serializeError(appErr.cause) : undefined }, 'request error');
    } else {
      logger.debug(logEntry, 'client error');
    }
    if (res.headersSent) return;
    if (appErr.code === 'RATE_LIMITED' || appErr.code === 'QUOTA_EXCEEDED') res.setHeader('Retry-After', '60');
    sendError(res, appErr.status, appErr.code, appErr.message, appErr.details);
  };
}
