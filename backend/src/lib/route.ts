import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import { Errors, type ErrorDetail } from './errors.js';

type Infer<T> = T extends z.ZodType ? z.output<T> : undefined;

export interface RouteSchemas<B extends z.ZodType | undefined, Q extends z.ZodType | undefined, P extends z.ZodType | undefined> {
  body?: B;
  query?: Q;
  params?: P;
}

export interface RouteContext<B, Q, P> {
  req: Request;
  res: Response;
  body: B;
  query: Q;
  params: P;
}

export function zodIssuesToDetails(error: z.ZodError, location: string): ErrorDetail[] {
  return error.issues.map((issue) => ({
    path: [location, ...issue.path.map(String)].join('.'),
    message: issue.message,
  }));
}

/**
 * Build an Express handler whose body/query/params are validated with Zod
 * before the handler runs. Unknown object keys are stripped by z.object()
 * (use z.strictObject() to reject them), which prevents mass assignment.
 * Express 5 forwards rejected promises to the error handler.
 *
 * Note: in Express 5 `req.query` is read-only, so validated values are passed
 * through the context object instead of being written back onto `req`.
 */
export function route<
  B extends z.ZodType | undefined = undefined,
  Q extends z.ZodType | undefined = undefined,
  P extends z.ZodType | undefined = undefined,
>(
  schemas: RouteSchemas<B, Q, P>,
  handler: (ctx: RouteContext<Infer<B>, Infer<Q>, Infer<P>>) => Promise<unknown> | unknown,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const details: ErrorDetail[] = [];
    const parse = (schema: z.ZodType | undefined, value: unknown, location: string): unknown => {
      if (!schema) return undefined;
      const result = schema.safeParse(value);
      if (!result.success) {
        details.push(...zodIssuesToDetails(result.error, location));
        return undefined;
      }
      return result.data;
    };
    const body = parse(schemas.body, req.body ?? {}, 'body');
    const query = parse(schemas.query, req.query ?? {}, 'query');
    const params = parse(schemas.params, req.params ?? {}, 'params');
    if (details.length > 0) {
      next(Errors.validation(details));
      return;
    }
    try {
      await handler({ req, res, body, query, params } as RouteContext<Infer<B>, Infer<Q>, Infer<P>>);
    } catch (err) {
      next(err);
    }
  };
}

/** Common param schemas. */
export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'must be a valid id');
export const idParams = z.object({ id: objectIdSchema });
