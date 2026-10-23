import { Router } from 'express';
import { z } from 'zod';
import { Errors } from '../../lib/errors.js';
import { route } from '../../lib/route.js';
import type { ObjectStorage } from '../../providers/storage/index.js';
import type { FilesService } from './files.service.js';

/**
 * GET /api/v1/files/signed/:token — serves a private object for a valid,
 * unexpired HMAC token (local storage only; S3 uses presigned URLs directly).
 * Any invalid, expired or deleted reference gives the same 404.
 */
export function createSignedFilesRouter(deps: { storage: ObjectStorage; files: FilesService }): Router {
  const router = Router();
  router.get(
    '/signed/:token',
    route({ params: z.object({ token: z.string().min(10).max(1024) }) }, async ({ params, res }) => {
      const key = deps.storage.resolveSignedToken?.(params.token) ?? null;
      if (!key) throw Errors.notFound('File');
      const meta = await deps.files.findByStorageKey(key);
      if (!meta || meta.deleted) throw Errors.notFound('File');
      let body: Buffer;
      try {
        body = await deps.storage.get(key);
      } catch {
        throw Errors.notFound('File');
      }
      res.setHeader('Content-Type', meta.contentType);
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Content-Disposition', 'inline');
      res.status(200).end(body);
    }),
  );
  return router;
}
