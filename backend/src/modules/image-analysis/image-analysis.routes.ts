import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { Errors } from '../../lib/errors.js';
import { sendCreated, sendOk } from '../../lib/http.js';
import { idParams, route } from '../../lib/route.js';
import type { AuthMiddleware } from '../../middleware/auth.js';
import { createRateLimiter } from '../../middleware/rate-limit.js';
import type { LanguageRegistry } from '../../shared/language-registry.js';
import type { ImageAnalysisService } from './image-analysis.service.js';

export function createImageAnalysisRouter(deps: {
  service: ImageAnalysisService;
  auth: AuthMiddleware;
  languages: Pick<LanguageRegistry, 'isEnabled'>;
  maxBytes: number;
  perMinute: number;
}): Router {
  const router = Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: deps.maxBytes, files: 1, fields: 5 } });
  router.use(deps.auth.requireAuth);

  router.post(
    '/',
    deps.auth.requirePermission('image:analyze'),
    createRateLimiter({ name: 'image-analysis', windowMs: 60_000, limit: deps.perMinute, keyBy: 'user' }),
    upload.single('image'),
    route(
      {
        body: z.object({
          cropKey: z.string().regex(/^[a-z][a-z0-9_]{1,59}$/).optional().or(z.literal('').transform(() => undefined)),
          symptomsText: z.string().trim().max(2000).optional(),
          language: z.string().regex(/^[a-z]{2}$/),
        }),
      },
      async ({ req, res, body }) => {
        if (!req.file) throw Errors.badRequest('Attach a photo in the "image" field');
        if (!(await deps.languages.isEnabled(body.language))) throw Errors.validation([{ path: 'body.language', message: 'Language not available' }]);
        sendCreated(res, await deps.service.analyze(req.auth!, { file: req.file.buffer, cropKey: body.cropKey, symptomsText: body.symptomsText || undefined, language: body.language }));
      },
    ),
  );

  router.get('/:id', route({ params: idParams }, async ({ req, res, params }) => sendOk(res, await deps.service.get(req.auth!, params.id))));
  router.get(
    '/:id/image-url',
    route({ params: idParams }, async ({ req, res, params }) => {
      res.setHeader('Cache-Control', 'no-store');
      sendOk(res, { url: await deps.service.imageUrl(req.auth!, params.id) });
    }),
  );
  return router;
}
