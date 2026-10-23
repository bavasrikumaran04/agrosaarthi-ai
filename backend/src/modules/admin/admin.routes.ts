import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { AuditLogModel } from '../../db/models/audit-log.model.js';
import { CallbackRequestModel } from '../../db/models/callback-request.model.js';
import { ImageAnalysisModel } from '../../db/models/image-analysis.model.js';
import { ModelVersionModel } from '../../db/models/model-version.model.js';
import { SupportCaseModel } from '../../db/models/support-case.model.js';
import { UserModel } from '../../db/models/user.model.js';
import { Errors } from '../../lib/errors.js';
import { sendCreated, sendOk, sendPaginated } from '../../lib/http.js';
import { buildPaginationMeta, escapeRegex, paginationQuerySchema, toSkipLimit } from '../../lib/pagination.js';
import { idParams, route } from '../../lib/route.js';
import type { AuthMiddleware } from '../../middleware/auth.js';
import { GRANTABLE_EXTRA_PERMISSIONS } from '../../shared/permissions.js';
import { ROLES, USER_STATUSES } from '../../shared/constants.js';
import type { AuditService } from '../audit/audit.service.js';
import { toUserDto } from '../auth/auth.dto.js';
import { passwordPolicyIssues, type PasswordHasher } from '../auth/password.js';
import type { ProviderStatusSource } from '../health/health.routes.js';

export function createAdminRouter(deps: {
  auth: AuthMiddleware;
  audit: AuditService;
  hasher: PasswordHasher;
  passwordMinLength: number;
  providers: ProviderStatusSource;
  providerChecks: () => Promise<Record<string, { ok: boolean; detail?: string }>>;
}): Router {
  const { auth, audit } = deps;
  const router = Router();
  router.use(auth.requireAuth);

  router.get(
    '/users',
    auth.requirePermission('user:manage'),
    route(
      { query: paginationQuerySchema.extend({ role: z.enum(ROLES).optional(), status: z.enum(USER_STATUSES).optional(), q: z.string().max(100).optional() }) },
      async ({ res, query }) => {
        const filter: Record<string, unknown> = {};
        if (query.role) filter.role = query.role;
        if (query.status) filter.status = query.status;
        if (query.q) filter.$or = [{ name: new RegExp(escapeRegex(query.q), 'i') }, { email: new RegExp(escapeRegex(query.q), 'i') }];
        const { skip, limit } = toSkipLimit(query);
        const [rows, total] = await Promise.all([UserModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), UserModel.countDocuments(filter)]);
        sendPaginated(res, rows.map(toUserDto), buildPaginationMeta(query, total));
      },
    ),
  );

  /** Create an expert or administrator. A one-time temporary password is returned once and must be changed at first sign-in. */
  router.post(
    '/users',
    auth.requirePermission('user:manage'),
    route(
      {
        body: z.strictObject({
          name: z.string().trim().min(1).max(120),
          email: z.email().max(254),
          role: z.enum(['EXPERT', 'ADMIN']),
          languages: z.array(z.string().regex(/^[a-z]{2}$/)).max(10).default(['ta', 'en']),
          password: z.string().max(128).optional(),
        }),
      },
      async ({ req, res, body }) => {
        const password = body.password ?? randomBytes(12).toString('base64url');
        const issues = passwordPolicyIssues(password, deps.passwordMinLength);
        if (issues.length) throw Errors.validation(issues.map((m) => ({ path: 'body.password', message: `Password ${m}` })));
        if (await UserModel.exists({ email: body.email.toLowerCase() })) throw Errors.conflict('A user with this email already exists');
        const user = await UserModel.create({
          name: body.name,
          email: body.email,
          role: body.role,
          passwordHash: await deps.hasher.hash(password),
          mustChangePassword: true,
          preferredLanguage: body.languages[0] ?? 'en',
          expertProfile: body.role === 'EXPERT' ? { languages: body.languages } : undefined,
        });
        await audit.recordFromRequest(req, { action: 'user.create', targetType: 'User', targetId: user._id.toHexString(), details: { role: body.role } });
        sendCreated(res, { user: toUserDto(user), temporaryPassword: body.password ? undefined : password });
      },
    ),
  );

  router.patch(
    '/users/:id',
    auth.requirePermission('user:manage'),
    route(
      {
        params: idParams,
        body: z.strictObject({
          status: z.enum(USER_STATUSES).optional(),
          extraPermissions: z.array(z.enum(GRANTABLE_EXTRA_PERMISSIONS as unknown as [string, ...string[]])).max(20).optional(),
          maxActiveCases: z.number().int().min(1).max(500).optional(),
        }),
      },
      async ({ req, res, params, body }) => {
        if (params.id === req.auth!.userId && body.status === 'DISABLED') throw Errors.badRequest('You cannot disable your own account');
        const $set: Record<string, unknown> = {};
        if (body.status) $set.status = body.status;
        if (body.extraPermissions) $set.extraPermissions = body.extraPermissions;
        if (body.maxActiveCases) $set['expertProfile.maxActiveCases'] = body.maxActiveCases;
        const update: Record<string, unknown> = { $set };
        if (body.status === 'DISABLED') update.$inc = { tokenVersion: 1 };
        const target = await UserModel.findById(params.id, { role: 1 }).lean();
        if (!target) throw Errors.notFound('User');
        if (target.role === 'FARMER' && body.extraPermissions?.length) throw Errors.badRequest('Farmers cannot be granted extra permissions');
        const user = await UserModel.findByIdAndUpdate(params.id, update, { new: true }).lean();
        if (!user) throw Errors.notFound('User');
        await audit.recordFromRequest(req, { action: 'user.update', targetType: 'User', targetId: params.id, details: { fields: Object.keys(body), status: body.status } });
        sendOk(res, toUserDto(user));
      },
    ),
  );

  router.get(
    '/metrics',
    auth.requirePermission('metrics:read'),
    route({}, async ({ res }) => {
      const since = new Date(Date.now() - 7 * 86_400_000);
      const [usersByRole, casesByStatus, analysesByOutcome, failedAnalyses7d, openCallbacks, simulatedAnalyses] = await Promise.all([
        UserModel.aggregate([{ $group: { _id: '$role', n: { $sum: 1 } } }]),
        SupportCaseModel.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
        ImageAnalysisModel.aggregate([{ $match: { status: 'COMPLETED' } }, { $group: { _id: '$outcome', n: { $sum: 1 } } }]),
        ImageAnalysisModel.countDocuments({ status: 'FAILED', createdAt: { $gte: since } }),
        CallbackRequestModel.countDocuments({ status: { $in: ['PENDING', 'SCHEDULED', 'IN_PROGRESS'] } }),
        ImageAnalysisModel.countDocuments({ 'model.simulated': true }),
      ]);
      const toObj = (rows: Array<{ _id: string | null; n: number }>) => Object.fromEntries(rows.map((r) => [r._id ?? 'UNKNOWN', r.n]));
      sendOk(res, {
        usersByRole: toObj(usersByRole),
        casesByStatus: toObj(casesByStatus),
        analysesByOutcome: toObj(analysesByOutcome),
        failedAnalysesLast7Days: failedAnalyses7d,
        openCallbacks,
        simulatedAnalyses,
      });
    }),
  );

  router.get(
    '/providers',
    auth.requirePermission('provider-health:read'),
    route({}, async ({ res }) => {
      sendOk(res, { configured: deps.providers.describeProviders(), checks: await deps.providerChecks() });
    }),
  );

  router.get(
    '/model-versions',
    auth.requirePermission('metrics:read'),
    route({}, async ({ res }) => {
      const rows = await ModelVersionModel.find({}).sort({ lastSeenAt: -1 }).limit(50).lean();
      sendOk(res, rows.map((r) => ({ id: r._id.toHexString(), name: r.name, version: r.version, provider: r.provider, simulated: r.simulated, firstSeenAt: r.firstSeenAt, lastSeenAt: r.lastSeenAt, modelCard: r.modelCard })));
    }),
  );

  router.get(
    '/audit',
    auth.requirePermission('audit:read'),
    route({ query: paginationQuerySchema.extend({ action: z.string().max(80).optional(), outcome: z.enum(['SUCCESS', 'DENIED', 'FAILURE']).optional() }) }, async ({ res, query }) => {
      const filter: Record<string, unknown> = {};
      if (query.action) filter.action = query.action;
      if (query.outcome) filter.outcome = query.outcome;
      const { skip, limit } = toSkipLimit(query);
      const [rows, total] = await Promise.all([AuditLogModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), AuditLogModel.countDocuments(filter)]);
      sendPaginated(
        res,
        rows.map((r) => ({ id: r._id.toHexString(), action: r.action, outcome: r.outcome, actorRole: r.actorRole, actorUserId: r.actorUserId?.toHexString(), targetType: r.targetType, targetId: r.targetId, details: r.details, createdAt: (r as { createdAt?: Date }).createdAt })),
        buildPaginationMeta(query, total),
      );
    }),
  );

  return router;
}
