import type { Types } from 'mongoose';
import { maskPhone } from '../../lib/phone.js';
import type { Role } from '../../shared/constants.js';
import { resolvePermissions } from '../../shared/permissions.js';

/** Shape returned to clients for a user. Never includes hashes or clear-text phone numbers. */
export interface UserDto {
  id: string;
  name: string;
  role: Role;
  status: string;
  email?: string;
  phoneMasked?: string;
  preferredLanguage: string;
  district?: string;
  state?: string;
  permissions: string[];
  extraPermissions: string[];
  mustChangePassword: boolean;
  expertProfile?: { specializations: string[]; languages: string[]; region?: string; maxActiveCases: number };
  lastLoginAt?: string;
  createdAt?: string;
  isDemo: boolean;
}

export interface UserLike {
  _id: Types.ObjectId;
  name: string;
  role: string;
  status?: string | null;
  email?: string | null;
  phone?: { last4: string } | null;
  preferredLanguage?: string | null;
  district?: string | null;
  state?: string | null;
  extraPermissions?: string[] | null;
  mustChangePassword?: boolean | null;
  expertProfile?: { specializations?: string[] | null; languages?: string[] | null; region?: string | null; maxActiveCases?: number | null } | null;
  lastLoginAt?: Date | null;
  createdAt?: Date | null;
  isDemo?: boolean | null;
}

export function toUserDto(u: UserLike): UserDto {
  const role = u.role as Role;
  const extra = u.extraPermissions ?? [];
  return {
    id: u._id.toHexString(),
    name: u.name,
    role,
    status: u.status ?? 'ACTIVE',
    email: u.email ?? undefined,
    phoneMasked: u.phone?.last4 ? maskPhone(u.phone.last4) : undefined,
    preferredLanguage: u.preferredLanguage ?? 'ta',
    district: u.district ?? undefined,
    state: u.state ?? undefined,
    permissions: [...resolvePermissions(role, extra)].sort(),
    extraPermissions: [...extra],
    mustChangePassword: u.mustChangePassword ?? false,
    expertProfile: u.expertProfile
      ? {
          specializations: u.expertProfile.specializations ?? [],
          languages: u.expertProfile.languages ?? [],
          region: u.expertProfile.region ?? undefined,
          maxActiveCases: u.expertProfile.maxActiveCases ?? 25,
        }
      : undefined,
    lastLoginAt: u.lastLoginAt?.toISOString(),
    createdAt: u.createdAt?.toISOString(),
    isDemo: u.isDemo ?? false,
  };
}
