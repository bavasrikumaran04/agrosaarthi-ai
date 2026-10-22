import type { Response } from 'express';

/**
 * Consistent response envelope for every JSON endpoint:
 *   success: { success: true,  data, meta: { requestId, pagination? } }
 *   failure: { success: false, error: { code, message, details? }, meta: { requestId } }
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ResponseMeta {
  requestId?: string;
  pagination?: PaginationMeta;
}

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta: ResponseMeta;
}

export interface ErrorEnvelope {
  success: false;
  error: { code: string; message: string; details?: unknown };
  meta: ResponseMeta;
}

function requestIdOf(res: Response): string | undefined {
  const id: unknown = res.locals.requestId;
  return typeof id === 'string' ? id : undefined;
}

export function sendOk<T>(res: Response, data: T, status = 200): void {
  // A request-timeout response may already have been sent; never write twice.
  if (res.headersSent) return;
  const body: SuccessEnvelope<T> = { success: true, data, meta: { requestId: requestIdOf(res) } };
  res.status(status).json(body);
}

export function sendCreated<T>(res: Response, data: T): void {
  sendOk(res, data, 201);
}

export function sendPaginated<T>(res: Response, items: T[], pagination: PaginationMeta): void {
  if (res.headersSent) return;
  const body: SuccessEnvelope<T[]> = { success: true, data: items, meta: { requestId: requestIdOf(res), pagination } };
  res.status(200).json(body);
}

export function sendNoContent(res: Response): void {
  if (res.headersSent) return;
  res.status(204).end();
}

export function sendError(res: Response, status: number, code: string, message: string, details?: unknown): void {
  if (res.headersSent) return;
  const body: ErrorEnvelope = {
    success: false,
    error: details === undefined ? { code, message } : { code, message, details },
    meta: { requestId: requestIdOf(res) },
  };
  res.status(status).json(body);
}
