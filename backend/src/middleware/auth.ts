import type { Request, RequestHandler } from 'express';
import { type AppError, Errors } from '../lib/errors.js';
import type { Role } from '../shared/constants.js';
import { resolvePermissions, type Permission } from '../shared/permissions.js';

export interface AuthContext {
  userId: string;
  role: Role;
  permissions: ReadonlySet<Permission>;
  displayName: string;
  preferredLanguage: string;
}

export interface AccessTokenClaims {
  userId: string;
  tokenVersion: number;
}

export interface AuthenticatedUserRecord {
  id: string;
  role: Role;
  status: string;
  name: string;
  preferredLanguage: string;
  extraPermissions: string[];
  tokenVersion: number;
}

export interface AuthMiddlewareDeps {
  verifyAccessToken: (token: string) => Promise<AccessTokenClaims>;
  loadUser: (userId: string) => Promise<AuthenticatedUserRecord | null>;
  /** Called whenever an authenticated request is refused (wired to the audit log). */
  onDenied?: (req: Request, reason: string) => void;
}

const BEARER = /^Bearer\s+([A-Za-z0-9\-._~+/]+=*)$/;

export function hasPermission(auth: AuthContext | undefined, permission: Permission): boolean {
  return auth !== undefined && auth.permissions.has(permission);
}

export interface AuthMiddleware {
  /** Attaches req.auth when a valid bearer token is present; rejects invalid tokens. */
  authenticate: RequestHandler;
  requireAuth: RequestHandler;
  requireRole: (...roles: Role[]) => RequestHandler;
  /** All listed permissions are required. */
  requirePermission: (...permissions: Permission[]) => RequestHandler;
  /** At least one of the listed permissions is required. */
  requireAnyPermission: (...permissions: Permission[]) => RequestHandler;
}

export function createAuthMiddleware(deps: AuthMiddlewareDeps): AuthMiddleware {
  const deny = (req: Request, reason: string): AppError => {
    deps.onDenied?.(req, reason);
    return Errors.forbidden();
  };

  const authenticate: RequestHandler = async (req, _res, next) => {
    const header = req.get('authorization');
    if (!header) {
      next();
      return;
    }
    const match = BEARER.exec(header);
    if (!match?.[1]) {
      next(Errors.unauthenticated('Malformed authorization header'));
      return;
    }
    let claims: AccessTokenClaims;
    try {
      claims = await deps.verifyAccessToken(match[1]);
    } catch {
      next(Errors.unauthenticated('Invalid or expired access token'));
      return;
    }
    try {
      const user = await deps.loadUser(claims.userId);
      // tokenVersion changes on password change / forced sign-out, invalidating older tokens.
      if (!user || user.status !== 'ACTIVE' || user.tokenVersion !== claims.tokenVersion) {
        next(Errors.unauthenticated('Session is no longer valid'));
        return;
      }
      req.auth = {
        userId: user.id,
        role: user.role,
        permissions: resolvePermissions(user.role, user.extraPermissions),
        displayName: user.name,
        preferredLanguage: user.preferredLanguage,
      };
      next();
    } catch (err) {
      next(err);
    }
  };

  const requireAuth: RequestHandler = (req, _res, next) => {
    next(req.auth ? undefined : Errors.unauthenticated());
  };

  const requireRole =
    (...roles: Role[]): RequestHandler =>
    (req, _res, next) => {
      if (!req.auth) return next(Errors.unauthenticated());
      if (!roles.includes(req.auth.role)) return next(deny(req, `role ${req.auth.role} not in [${roles.join(',')}]`));
      next();
    };

  const requirePermission =
    (...permissions: Permission[]): RequestHandler =>
    (req, _res, next) => {
      if (!req.auth) return next(Errors.unauthenticated());
      const missing = permissions.filter((p) => !req.auth!.permissions.has(p));
      if (missing.length > 0) return next(deny(req, `missing permission(s) ${missing.join(',')}`));
      next();
    };

  const requireAnyPermission =
    (...permissions: Permission[]): RequestHandler =>
    (req, _res, next) => {
      if (!req.auth) return next(Errors.unauthenticated());
      if (!permissions.some((p) => req.auth!.permissions.has(p))) {
        return next(deny(req, `needs one of ${permissions.join(',')}`));
      }
      next();
    };

  return { authenticate, requireAuth, requireRole, requirePermission, requireAnyPermission };
}
