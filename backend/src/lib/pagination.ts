import { z } from 'zod';
import type { PaginationMeta } from './http.js';

export const MAX_PAGE_SIZE = 100;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
});
export type PaginationQuery = z.output<typeof paginationQuerySchema>;

export function toSkipLimit(q: PaginationQuery): { skip: number; limit: number } {
  return { skip: (q.page - 1) * q.pageSize, limit: q.pageSize };
}

export function buildPaginationMeta(q: PaginationQuery, total: number): PaginationMeta {
  return { page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) };
}

/** Escape user text before using it inside a MongoDB $regex. */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
