import { Types } from 'mongoose';
import { UserModel } from '../../db/models/user.model.js';
import type { AuthenticatedUserRecord } from '../../middleware/auth.js';
import type { Role } from '../../shared/constants.js';

/**
 * Loads the user behind an access token on every request, so disabling an
 * account or changing a role takes effect immediately (not at token expiry).
 */
export async function loadAuthenticatedUser(userId: string): Promise<AuthenticatedUserRecord | null> {
  if (!Types.ObjectId.isValid(userId)) return null;
  const user = await UserModel.findById(userId, {
    role: 1,
    status: 1,
    name: 1,
    preferredLanguage: 1,
    extraPermissions: 1,
    tokenVersion: 1,
  }).lean();
  if (!user) return null;
  return {
    id: user._id.toHexString(),
    role: user.role as Role,
    status: user.status ?? 'ACTIVE',
    name: user.name,
    preferredLanguage: user.preferredLanguage ?? 'ta',
    extraPermissions: user.extraPermissions ?? [],
    tokenVersion: user.tokenVersion ?? 0,
  };
}
