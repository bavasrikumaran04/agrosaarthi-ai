import type { AppConfig } from './config/index.js';
import { systemClock, type Clock } from './lib/clock.js';
import type { Logger } from './lib/logger.js';
import { createPersonalDataProtector, type PersonalDataProtector } from './lib/personal-data.js';
import { createAuthMiddleware, type AuthMiddleware } from './middleware/auth.js';
import { createAuditService, type AuditService } from './modules/audit/audit.service.js';
import { createAuthService, type AuthService } from './modules/auth/auth.service.js';
import { createPasswordHasher, type PasswordHasher } from './modules/auth/password.js';
import { createTokenService, type TokenService } from './modules/auth/token.service.js';
import { loadAuthenticatedUser } from './modules/auth/user-loader.js';
import { createLanguageRegistry, type DbLanguageRegistry } from './modules/languages/language-registry.service.js';

/**
 * Core services shared by every module. Feature modules receive what they
 * need from here through their factory functions (explicit dependency
 * injection — no module-level singletons), which keeps them testable.
 */
export interface CoreContainer {
  config: AppConfig;
  logger: Logger;
  clock: Clock;
  protector: PersonalDataProtector;
  audit: AuditService;
  hasher: PasswordHasher;
  tokens: TokenService;
  languages: DbLanguageRegistry;
  authService: AuthService;
  authMiddleware: AuthMiddleware;
}

export function createCoreContainer(config: AppConfig, logger: Logger, overrides: Partial<CoreContainer> = {}): CoreContainer {
  const clock = overrides.clock ?? systemClock;
  const protector =
    overrides.protector ?? createPersonalDataProtector(config.security.dataEncryptionKey, config.security.dataHashKey);
  const audit = overrides.audit ?? createAuditService({ logger, clock, retentionDays: config.retention.auditLogDays });
  const hasher =
    overrides.hasher ??
    createPasswordHasher({ memoryCostKiB: config.auth.passwordHashMemoryKiB, timeCost: config.auth.passwordHashTimeCost });
  const tokens = overrides.tokens ?? createTokenService(config.auth, clock);
  const languages = overrides.languages ?? createLanguageRegistry({ logger });
  const authService =
    overrides.authService ?? createAuthService({ config: config.auth, clock, hasher, tokens, protector, audit, languages });
  const authMiddleware =
    overrides.authMiddleware ??
    createAuthMiddleware({
      verifyAccessToken: (t) => tokens.verifyAccessToken(t),
      loadUser: loadAuthenticatedUser,
      onDenied: (req, reason) => {
        void audit.recordFromRequest(req, {
          action: 'authz.denied',
          outcome: 'DENIED',
          details: { method: req.method, path: req.baseUrl + req.path, reason },
        });
      },
    });

  return { config, logger, clock, protector, audit, hasher, tokens, languages, authService, authMiddleware };
}
