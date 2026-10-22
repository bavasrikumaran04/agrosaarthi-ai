import { randomUUID } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { Types } from 'mongoose';
import type { AuthConfig } from '../../config/sections/auth.js';
import { RefreshTokenModel } from '../../db/models/refresh-token.model.js';
import { addDays, type Clock } from '../../lib/clock.js';
import { randomToken, sha256Hex } from '../../lib/crypto.js';
import { Errors } from '../../lib/errors.js';
import type { AccessTokenClaims } from '../../middleware/auth.js';

/** Window in which re-presenting a just-rotated refresh token is treated as a benign race (multiple tabs). */
const ROTATION_GRACE_MS = 15_000;

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
  familyId: string;
}

export interface TokenService {
  issueAccessToken(user: { id: string; tokenVersion: number; role: string }): Promise<{ token: string; expiresIn: number }>;
  verifyAccessToken(token: string): Promise<AccessTokenClaims>;
  issueRefreshToken(userId: string, familyId?: string): Promise<IssuedRefreshToken>;
  /** Validate + rotate. Re-use of a rotated token (outside the grace window) revokes the whole family. */
  rotateRefreshToken(token: string): Promise<{ userId: string; next: IssuedRefreshToken }>;
  revokeRefreshFamily(token: string): Promise<void>;
  revokeAllForUser(userId: string, reason: string): Promise<void>;
}

export function createTokenService(config: AuthConfig, clock: Clock): TokenService {
  const key = new TextEncoder().encode(config.accessSecret);

  const issueRefreshToken = async (userId: string, familyId: string = randomUUID()): Promise<IssuedRefreshToken> => {
    const token = randomToken(32);
    const expiresAt = addDays(clock.now(), config.refreshTtlDays);
    await RefreshTokenModel.create({ userId: new Types.ObjectId(userId), tokenHash: sha256Hex(token), familyId, expiresAt });
    return { token, expiresAt, familyId };
  };

  return {
    async issueAccessToken(user) {
      const token = await new SignJWT({ tv: user.tokenVersion, role: user.role })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setSubject(user.id)
        .setIssuer(config.issuer)
        .setAudience(config.audience)
        .setIssuedAt()
        .setJti(randomUUID())
        .setExpirationTime(`${config.accessTtlSeconds}s`)
        .sign(key);
      return { token, expiresIn: config.accessTtlSeconds };
    },

    async verifyAccessToken(token) {
      const { payload } = await jwtVerify(token, key, {
        issuer: config.issuer,
        audience: config.audience,
        algorithms: ['HS256'],
      });
      if (typeof payload.sub !== 'string' || !Types.ObjectId.isValid(payload.sub) || typeof payload.tv !== 'number') {
        throw new Error('Malformed access token claims');
      }
      return { userId: payload.sub, tokenVersion: payload.tv };
    },

    issueRefreshToken,

    async rotateRefreshToken(token) {
      const tokenHash = sha256Hex(token);
      const now = clock.now();
      // Atomically claim the token so two concurrent refreshes cannot both succeed.
      const claimed = await RefreshTokenModel.findOneAndUpdate(
        { tokenHash, revokedAt: { $exists: false }, expiresAt: { $gt: now } },
        { $set: { revokedAt: now, revokedReason: 'rotated' } },
        { new: false },
      ).lean();

      if (!claimed) {
        const existing = await RefreshTokenModel.findOne({ tokenHash }).lean();
        if (existing?.revokedAt) {
          const benignRace =
            existing.revokedReason === 'rotated' && now.getTime() - existing.revokedAt.getTime() < ROTATION_GRACE_MS;
          if (!benignRace) {
            // A rotated token was replayed: assume theft and kill the whole family.
            await RefreshTokenModel.updateMany(
              { familyId: existing.familyId, revokedAt: { $exists: false } },
              { $set: { revokedAt: now, revokedReason: 'reuse-detected' } },
            );
          }
        }
        throw Errors.unauthenticated('Session expired, please sign in again');
      }

      const next = await issueRefreshToken(String(claimed.userId), claimed.familyId);
      await RefreshTokenModel.updateOne({ _id: claimed._id }, { $set: { replacedByHash: sha256Hex(next.token) } });
      return { userId: String(claimed.userId), next };
    },

    async revokeRefreshFamily(token) {
      const existing = await RefreshTokenModel.findOne({ tokenHash: sha256Hex(token) }).lean();
      if (!existing) return;
      await RefreshTokenModel.updateMany(
        { familyId: existing.familyId, revokedAt: { $exists: false } },
        { $set: { revokedAt: clock.now(), revokedReason: 'logout' } },
      );
    },

    async revokeAllForUser(userId, reason) {
      await RefreshTokenModel.updateMany(
        { userId: new Types.ObjectId(userId), revokedAt: { $exists: false } },
        { $set: { revokedAt: clock.now(), revokedReason: reason.slice(0, 60) } },
      );
    },
  };
}
