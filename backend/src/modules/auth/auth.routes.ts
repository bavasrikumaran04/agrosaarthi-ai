import { Router, type CookieOptions, type Request, type Response } from 'express';
import type { AppConfig } from '../../config/index.js';
import { sendNoContent, sendOk, sendCreated } from '../../lib/http.js';
import { route } from '../../lib/route.js';
import type { AuthMiddleware } from '../../middleware/auth.js';
import { createRateLimiter } from '../../middleware/rate-limit.js';
import { requireCsrfHeader } from '../../middleware/security.js';
import { changePasswordSchema, loginSchema, registerFarmerSchema, updateMeSchema } from './auth.schemas.js';
import type { AuthService, SessionTokens } from './auth.service.js';

export const REFRESH_COOKIE_NAME = 'as_refresh';
export const AUTH_BASE_PATH = '/api/v1/auth';

export interface AuthRouterDeps {
  config: AppConfig;
  auth: AuthMiddleware;
  service: AuthService;
}

export function createAuthRouter(deps: AuthRouterDeps): Router {
  const { config, auth, service } = deps;
  const router = Router();

  const cookieBase: CookieOptions = {
    httpOnly: true,
    secure: config.auth.cookieSecure,
    sameSite: config.auth.cookieSameSite,
    domain: config.auth.cookieDomain,
    path: AUTH_BASE_PATH,
  };

  const authLimiter = createRateLimiter({
    name: 'auth',
    windowMs: 15 * 60 * 1000,
    limit: config.security.authRateLimitMax,
    message: 'Too many sign-in attempts. Please wait a few minutes and try again.',
  });
  const csrf = requireCsrfHeader(config.core.frontendOrigins);

  const respondWithSession = (res: Response, session: SessionTokens, status: 200 | 201 = 200) => {
    res.cookie(REFRESH_COOKIE_NAME, session.refresh.token, { ...cookieBase, expires: session.refresh.expiresAt });
    res.setHeader('Cache-Control', 'no-store');
    const body = { accessToken: session.accessToken, tokenType: 'Bearer', expiresIn: session.expiresIn, user: session.user };
    if (status === 201) sendCreated(res, body);
    else sendOk(res, body);
  };

  const readRefreshCookie = (req: Request): string | undefined => {
    const value: unknown = req.cookies?.[REFRESH_COOKIE_NAME];
    return typeof value === 'string' && value.length > 0 && value.length < 200 ? value : undefined;
  };

  const requestIdOf = (res: Response) => (typeof res.locals.requestId === 'string' ? res.locals.requestId : undefined);

  router.post(
    '/register',
    authLimiter,
    route({ body: registerFarmerSchema }, async ({ body, res }) => {
      respondWithSession(res, await service.registerFarmer(body, requestIdOf(res)), 201);
    }),
  );

  router.post(
    '/login',
    authLimiter,
    route({ body: loginSchema }, async ({ body, res }) => {
      respondWithSession(res, await service.login(body.identifier, body.password, requestIdOf(res)));
    }),
  );

  router.post(
    '/refresh',
    csrf,
    route({}, async ({ req, res }) => {
      const token = readRefreshCookie(req);
      if (!token) {
        res.clearCookie(REFRESH_COOKIE_NAME, cookieBase);
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHENTICATED', message: 'No active session' },
          meta: { requestId: requestIdOf(res) },
        });
        return;
      }
      try {
        respondWithSession(res, await service.refresh(token));
      } catch (err) {
        res.clearCookie(REFRESH_COOKIE_NAME, cookieBase);
        throw err;
      }
    }),
  );

  router.post(
    '/logout',
    csrf,
    route({}, async ({ req, res }) => {
      await service.logout(readRefreshCookie(req));
      res.clearCookie(REFRESH_COOKIE_NAME, cookieBase);
      sendNoContent(res);
    }),
  );

  router.post(
    '/logout-all',
    auth.requireAuth,
    route({}, async ({ req, res }) => {
      await service.logoutAll(req.auth!.userId);
      res.clearCookie(REFRESH_COOKIE_NAME, cookieBase);
      sendNoContent(res);
    }),
  );

  router.get(
    '/me',
    auth.requireAuth,
    route({}, async ({ req, res }) => {
      sendOk(res, await service.me(req.auth!.userId));
    }),
  );

  router.patch(
    '/me',
    auth.requireAuth,
    route({ body: updateMeSchema }, async ({ req, res, body }) => {
      sendOk(res, await service.updateMe(req.auth!.userId, body));
    }),
  );

  router.post(
    '/change-password',
    auth.requireAuth,
    authLimiter,
    route({ body: changePasswordSchema }, async ({ req, res, body }) => {
      respondWithSession(res, await service.changePassword(req.auth!.userId, body.currentPassword, body.newPassword));
    }),
  );

  return router;
}
