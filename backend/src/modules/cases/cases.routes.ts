import { Router } from 'express';
import { z } from 'zod';
import { sendCreated, sendNoContent, sendOk, sendPaginated } from '../../lib/http.js';
import { paginationQuerySchema } from '../../lib/pagination.js';
import { idParams, objectIdSchema, route } from '../../lib/route.js';
import type { AuthMiddleware } from '../../middleware/auth.js';
import { createRateLimiter } from '../../middleware/rate-limit.js';
import { CASE_PRIORITIES, CASE_STATUSES } from '../../shared/constants.js';
import type { LanguageRegistry } from '../../shared/language-registry.js';
import { Errors } from '../../lib/errors.js';
import type { CasesService } from './cases.service.js';

const text = (max: number) => z.string().trim().min(1).max(max);

export function createCasesRouter(deps: { service: CasesService; auth: AuthMiddleware; languages: Pick<LanguageRegistry, 'isEnabled'> }): Router {
  const { service, auth } = deps;
  const router = Router();
  router.use(auth.requireAuth);

  router.get(
    '/',
    route(
      {
        query: paginationQuerySchema.extend({
          scope: z.enum(['mine', 'assigned', 'unassigned', 'resolved', 'all']).optional(),
          status: z.enum(CASE_STATUSES).optional(),
          priority: z.enum(CASE_PRIORITIES).optional(),
          cropKey: z.string().regex(/^[a-z][a-z0-9_]{1,59}$/).optional(),
          q: z.string().max(100).optional(),
        }),
      },
      async ({ req, res, query }) => {
        const out = await service.list(req.auth!, query);
        sendPaginated(res, out.items, out.pagination);
      },
    ),
  );

  router.post(
    '/',
    auth.requirePermission('case:create'),
    route(
      {
        body: z.strictObject({
          language: z.string().regex(/^[a-z]{2}$/),
          cropKey: z.string().regex(/^[a-z][a-z0-9_]{1,59}$/).optional(),
          cropFreeText: z.string().trim().max(120).optional(),
          symptomsText: text(2000),
          district: z.string().trim().max(120).optional(),
        }),
      },
      async ({ req, res, body }) => {
        if (!(await deps.languages.isEnabled(body.language))) throw Errors.validation([{ path: 'body.language', message: 'Language not available' }]);
        sendCreated(res, await service.createManual(req.auth!, body));
      },
    ),
  );

  router.get('/experts', auth.requireAnyPermission('case:assign', 'case:triage'), route({}, async ({ res }) => sendOk(res, await service.listExperts())));
  router.get('/dashboard', auth.requireRole('EXPERT', 'ADMIN'), route({}, async ({ req, res }) => sendOk(res, await service.expertDashboard(req.auth!))));

  router.get('/:id', route({ params: idParams }, async ({ req, res, params }) => sendOk(res, await service.detail(req.auth!, params.id))));

  router.post(
    '/:id/escalate',
    route({ params: idParams, body: z.strictObject({ reason: z.string().trim().max(1000).optional() }) }, async ({ req, res, params, body }) =>
      sendOk(res, await service.requestExpertReview(req.auth!, params.id, body.reason)),
    ),
  );

  router.post(
    '/:id/messages',
    auth.requirePermission('case:message'),
    route({ params: idParams, body: z.strictObject({ text: text(4000), internal: z.boolean().default(false) }) }, async ({ req, res, params, body }) => {
      await service.addMessage(req.auth!, params.id, body.text, body.internal);
      sendNoContent(res);
    }),
  );

  router.post(
    '/:id/assign',
    auth.requireAnyPermission('case:assign', 'case:assign:self'),
    route({ params: idParams, body: z.strictObject({ expertId: objectIdSchema }) }, async ({ req, res, params, body }) =>
      sendOk(res, await service.assign(req.auth!, params.id, body.expertId)),
    ),
  );

  router.post(
    '/:id/status',
    route({ params: idParams, body: z.strictObject({ to: z.enum(CASE_STATUSES), note: z.string().trim().max(2000).optional() }) }, async ({ req, res, params, body }) =>
      sendOk(res, await service.setStatus(req.auth!, params.id, body.to, body.note)),
    ),
  );

  router.post(
    '/:id/priority',
    auth.requireRole('EXPERT', 'ADMIN'),
    route({ params: idParams, body: z.strictObject({ priority: z.enum(CASE_PRIORITIES) }) }, async ({ req, res, params, body }) => {
      await service.setPriority(req.auth!, params.id, body.priority);
      sendNoContent(res);
    }),
  );

  router.post(
    '/:id/assessments',
    auth.requireAnyPermission('case:assess'),
    route(
      {
        params: idParams,
        body: z.strictObject({
          diagnosis: text(1000),
          certainty: z.enum(['CONFIRMED', 'PROBABLE', 'UNCERTAIN']),
          recommendations: z.string().trim().max(4000).default(''),
          aiAgreement: z.enum(['AGREES', 'PARTIALLY_AGREES', 'DISAGREES', 'NOT_APPLICABLE']),
          visibleToFarmer: z.boolean().default(true),
        }),
      },
      async ({ req, res, params, body }) => {
        await service.addAssessment(req.auth!, params.id, body);
        sendCreated(res, { ok: true });
      },
    ),
  );

  router.post(
    '/:id/callback',
    auth.requirePermission('callback:create'),
    route(
      { params: idParams, body: z.strictObject({ preferredTimeWindow: z.enum(['MORNING', 'AFTERNOON', 'EVENING', 'ANY']).default('ANY'), reason: z.string().trim().max(500).optional() }) },
      async ({ req, res, params, body }) => {
        const r = await service.requestCallback(req.auth!, params.id, body);
        // Never promise a time: the service can only attempt a callback.
        sendOk(res, { ...r, message: 'An agricultural expert will try to call you back. An exact time cannot be guaranteed.' }, r.created ? 201 : 200);
      },
    ),
  );

  router.post(
    '/callbacks/:id/attempts',
    auth.requirePermission('callback:manage'),
    route(
      { params: idParams, body: z.strictObject({ outcome: z.enum(['CONNECTED', 'NO_ANSWER', 'BUSY', 'WRONG_NUMBER', 'FAILED']), notes: z.string().trim().max(1000).optional() }) },
      async ({ req, res, params, body }) => {
        await service.recordCallbackAttempt(req.auth!, params.id, body.outcome, body.notes);
        sendNoContent(res);
      },
    ),
  );

  router.post(
    '/:id/reveal-contact',
    auth.requirePermission('farmer-contact:reveal'),
    createRateLimiter({ name: 'reveal', windowMs: 60 * 60 * 1000, limit: 30, keyBy: 'user' }),
    route({ params: idParams }, async ({ req, res, params }) => {
      res.setHeader('Cache-Control', 'no-store');
      sendOk(res, await service.revealContact(req.auth!, params.id));
    }),
  );

  return router;
}
