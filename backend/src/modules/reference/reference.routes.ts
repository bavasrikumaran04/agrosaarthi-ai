import { Router } from 'express';
import { z } from 'zod';
import { sendOk } from '../../lib/http.js';
import { route } from '../../lib/route.js';
import type { AuthMiddleware } from '../../middleware/auth.js';
import type { AuditService } from '../audit/audit.service.js';
import type { ReferenceService } from './reference.service.js';

const lang = z.object({ language: z.string().regex(/^[a-z]{2}$/).default('en') });
const keyParam = z.object({ key: z.string().regex(/^[a-z][a-z0-9_]{1,99}$/) });

/** Public crop/disease reference endpoints (read) + admin updates (reference:manage). */
export function createReferenceRouter(deps: { service: ReferenceService; auth: AuthMiddleware; audit: AuditService }): Router {
  const { service, auth } = deps;
  const router = Router();

  router.get('/crops', route({ query: lang }, async ({ res, query }) => sendOk(res, await service.listCrops(query.language))));
  router.get(
    '/crops/:key',
    route({ query: lang, params: keyParam }, async ({ res, query, params }) => sendOk(res, await service.getCrop(params.key, query.language))),
  );
  router.get(
    '/diseases',
    route({ query: lang.extend({ cropKey: z.string().regex(/^[a-z][a-z0-9_]{1,59}$/).optional() }) }, async ({ res, query }) =>
      sendOk(res, await service.listDiseases(query.language, query.cropKey)),
    ),
  );
  router.get(
    '/diseases/:key',
    route({ query: lang, params: keyParam }, async ({ res, query, params }) => sendOk(res, await service.getDisease(params.key, query.language))),
  );

  router.patch(
    '/crops/:key',
    auth.requireAuth,
    auth.requirePermission('reference:manage'),
    route(
      {
        params: keyParam,
        body: z.strictObject({
          names: z.record(z.string().regex(/^[a-z]{2}$/), z.string().trim().min(1).max(120)).optional(),
          active: z.boolean().optional(),
          notes: z.string().max(2000).optional(),
        }),
      },
      async ({ req, res, params, body }) => {
        const crop = await service.updateCrop(params.key, body, req.auth!.userId);
        await deps.audit.recordFromRequest(req, { action: 'reference.crop_update', targetType: 'Crop', targetId: params.key, details: { fields: Object.keys(body) } });
        sendOk(res, crop);
      },
    ),
  );
  return router;
}
