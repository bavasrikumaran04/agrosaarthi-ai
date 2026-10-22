import { Types } from 'mongoose';
import type { AuthConfig } from '../../config/sections/auth.js';
import { UserModel } from '../../db/models/user.model.js';
import { addMinutes, type Clock } from '../../lib/clock.js';
import { Errors } from '../../lib/errors.js';
import type { PersonalDataProtector } from '../../lib/personal-data.js';
import { PRIVACY_NOTICE_VERSION, type LanguageRegistry } from '../../shared/language-registry.js';
import type { AuditService } from '../audit/audit.service.js';
import type { RegisterFarmerInput, UpdateMeInput } from './auth.schemas.js';
import { toUserDto, type UserDto } from './auth.dto.js';
import { passwordPolicyIssues, type PasswordHasher } from './password.js';
import type { IssuedRefreshToken, TokenService } from './token.service.js';

export interface SessionTokens {
  user: UserDto;
  accessToken: string;
  expiresIn: number;
  refresh: IssuedRefreshToken;
}

export interface AuthService {
  registerFarmer(input: RegisterFarmerInput, requestId?: string): Promise<SessionTokens>;
  login(identifier: string, password: string, requestId?: string): Promise<SessionTokens>;
  refresh(refreshToken: string): Promise<SessionTokens>;
  logout(refreshToken: string | undefined): Promise<void>;
  logoutAll(userId: string): Promise<void>;
  me(userId: string): Promise<UserDto>;
  updateMe(userId: string, patch: UpdateMeInput): Promise<UserDto>;
  changePassword(userId: string, currentPassword: string, newPassword: string): Promise<SessionTokens>;
}

export interface AuthServiceDeps {
  config: AuthConfig;
  clock: Clock;
  hasher: PasswordHasher;
  tokens: TokenService;
  protector: PersonalDataProtector;
  audit: AuditService;
  languages: Pick<LanguageRegistry, 'isEnabled'>;
}

const INVALID_CREDENTIALS = 'Invalid phone number/email or password';

export function createAuthService(deps: AuthServiceDeps): AuthService {
  const { config, clock, hasher, tokens, protector, audit } = deps;

  const startSession = async (user: Parameters<typeof toUserDto>[0] & { tokenVersion?: number | null }) => {
    const id = user._id.toHexString();
    const access = await tokens.issueAccessToken({ id, tokenVersion: user.tokenVersion ?? 0, role: user.role });
    const refresh = await tokens.issueRefreshToken(id);
    return { user: toUserDto(user), accessToken: access.token, expiresIn: access.expiresIn, refresh };
  };

  const assertPasswordPolicy = (password: string, field: string) => {
    const issues = passwordPolicyIssues(password, config.passwordMinLength);
    if (issues.length > 0) throw Errors.validation(issues.map((message) => ({ path: field, message: `Password ${message}` })));
  };

  const assertLanguage = async (code: string) => {
    if (!(await deps.languages.isEnabled(code))) {
      throw Errors.validation([{ path: 'body.preferredLanguage', message: 'This language is not currently available' }]);
    }
  };

  return {
    async registerFarmer(input, requestId) {
      if (input.consent.privacyNoticeVersion !== PRIVACY_NOTICE_VERSION) {
        throw Errors.badRequest('The privacy notice has changed; please review and accept the current version', {
          currentVersion: PRIVACY_NOTICE_VERSION,
        });
      }
      assertPasswordPolicy(input.password, 'body.password');
      await assertLanguage(input.preferredLanguage);
      const phone = protector.protectPhone(input.phone);
      if (!phone) throw Errors.validation([{ path: 'body.phone', message: 'Enter a valid mobile number' }]);
      if (await UserModel.exists({ 'phone.hash': phone.hash })) {
        throw Errors.conflict('An account with this phone number already exists');
      }
      const now = clock.now();
      const created = await UserModel.create({
        name: input.name,
        phone,
        role: 'FARMER',
        passwordHash: await hasher.hash(input.password),
        preferredLanguage: input.preferredLanguage,
        district: input.district,
        state: input.state,
        consent: { aiProcessing: true, privacyNoticeVersion: input.consent.privacyNoticeVersion, givenAt: now },
        lastLoginAt: now,
      });
      await audit.record({
        actor: { type: 'USER', userId: created._id.toHexString(), role: 'FARMER' },
        action: 'auth.register',
        targetType: 'User',
        targetId: created._id.toHexString(),
        requestId,
      });
      return startSession(created);
    },

    async login(identifier, password, requestId) {
      const isEmail = identifier.includes('@');
      const lookupHash = isEmail ? null : protector.phoneLookupHash(identifier);
      const user =
        isEmail
          ? await UserModel.findOne({ email: identifier.toLowerCase() }).select('+passwordHash')
          : lookupHash
            ? await UserModel.findOne({ 'phone.hash': lookupHash }).select('+passwordHash')
            : null;

      if (!user) {
        await hasher.verifyDummy(password);
        await audit.record({ actor: { type: 'SYSTEM' }, action: 'auth.login', outcome: 'FAILURE', requestId, details: { reason: 'unknown-account' } });
        throw Errors.unauthenticated(INVALID_CREDENTIALS);
      }

      const now = clock.now();
      const userId = user._id.toHexString();
      if (user.lockedUntil && user.lockedUntil > now) {
        await audit.record({ actor: { type: 'SYSTEM' }, action: 'auth.login', targetType: 'User', targetId: userId, outcome: 'DENIED', requestId, details: { reason: 'locked' } });
        throw Errors.accountLocked();
      }

      const valid = await hasher.verify(user.passwordHash, password);
      if (!valid) {
        const failed = (user.failedLoginCount ?? 0) + 1;
        const lock = failed >= config.loginMaxFailedAttempts;
        await UserModel.updateOne(
          { _id: user._id },
          lock
            ? { $set: { failedLoginCount: 0, lockedUntil: addMinutes(now, config.loginLockoutMinutes) } }
            : { $set: { failedLoginCount: failed } },
        );
        await audit.record({
          actor: { type: 'SYSTEM' },
          action: lock ? 'auth.lockout' : 'auth.login',
          targetType: 'User',
          targetId: userId,
          outcome: 'FAILURE',
          requestId,
          details: { reason: 'bad-password' },
        });
        throw Errors.unauthenticated(INVALID_CREDENTIALS);
      }

      if (user.status !== 'ACTIVE') {
        await audit.record({ actor: { type: 'SYSTEM' }, action: 'auth.login', targetType: 'User', targetId: userId, outcome: 'DENIED', requestId, details: { reason: 'disabled' } });
        throw Errors.forbidden('This account has been disabled. Please contact the administrator.');
      }

      await UserModel.updateOne({ _id: user._id }, { $set: { failedLoginCount: 0, lastLoginAt: now }, $unset: { lockedUntil: 1 } });
      user.lastLoginAt = now;
      await audit.record({ actor: { type: 'USER', userId, role: user.role }, action: 'auth.login', targetType: 'User', targetId: userId, requestId });
      return startSession(user);
    },

    async refresh(refreshToken) {
      const { userId, next } = await tokens.rotateRefreshToken(refreshToken);
      const user = await UserModel.findById(userId);
      if (!user || user.status !== 'ACTIVE') {
        await tokens.revokeAllForUser(userId, 'inactive-user');
        throw Errors.unauthenticated('Session expired, please sign in again');
      }
      const access = await tokens.issueAccessToken({ id: userId, tokenVersion: user.tokenVersion ?? 0, role: user.role });
      return { user: toUserDto(user), accessToken: access.token, expiresIn: access.expiresIn, refresh: next };
    },

    async logout(refreshToken) {
      if (refreshToken) await tokens.revokeRefreshFamily(refreshToken);
    },

    async logoutAll(userId) {
      await UserModel.updateOne({ _id: new Types.ObjectId(userId) }, { $inc: { tokenVersion: 1 } });
      await tokens.revokeAllForUser(userId, 'logout-all');
    },

    async me(userId) {
      const user = await UserModel.findById(userId);
      if (!user) throw Errors.notFound('User');
      return toUserDto(user);
    },

    async updateMe(userId, patch) {
      if (patch.preferredLanguage) await assertLanguage(patch.preferredLanguage);
      const $set: Record<string, unknown> = {};
      const $unset: Record<string, 1> = {};
      if (patch.name !== undefined) $set.name = patch.name;
      if (patch.preferredLanguage !== undefined) $set.preferredLanguage = patch.preferredLanguage;
      for (const field of ['district', 'state'] as const) {
        if (patch[field] === null) $unset[field] = 1;
        else if (patch[field] !== undefined) $set[field] = patch[field];
      }
      const user = await UserModel.findByIdAndUpdate(
        userId,
        { ...(Object.keys($set).length ? { $set } : {}), ...(Object.keys($unset).length ? { $unset } : {}) },
        { new: true, runValidators: true },
      );
      if (!user) throw Errors.notFound('User');
      return toUserDto(user);
    },

    async changePassword(userId, currentPassword, newPassword) {
      const user = await UserModel.findById(userId).select('+passwordHash');
      if (!user) throw Errors.notFound('User');
      if (!(await hasher.verify(user.passwordHash, currentPassword))) {
        await audit.record({ actor: { type: 'USER', userId, role: user.role }, action: 'auth.password_change', targetType: 'User', targetId: userId, outcome: 'FAILURE' });
        throw Errors.unauthenticated('Current password is incorrect');
      }
      assertPasswordPolicy(newPassword, 'body.newPassword');
      if (currentPassword === newPassword) {
        throw Errors.validation([{ path: 'body.newPassword', message: 'New password must differ from the current password' }]);
      }
      user.passwordHash = await hasher.hash(newPassword);
      user.mustChangePassword = false;
      user.tokenVersion = (user.tokenVersion ?? 0) + 1; // invalidates all existing access tokens
      await user.save();
      await tokens.revokeAllForUser(userId, 'password-change');
      await audit.record({ actor: { type: 'USER', userId, role: user.role }, action: 'auth.password_change', targetType: 'User', targetId: userId });
      return startSession(user);
    },
  };
}
