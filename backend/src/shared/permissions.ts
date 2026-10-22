import type { Role } from './constants.js';

/**
 * Fine-grained permissions. Roles grant a default set; administrators can grant
 * individual extra permissions to a user (e.g. `case:read:all` for a senior
 * expert). Every privileged route checks permissions server-side.
 */
export const PERMISSIONS = [
  // Farmer-facing
  'case:create',
  'case:read:own',
  'image:analyze',
  'assistant:use',
  'voice:use',
  'callback:create',
  'privacy-request:create',
  // Expert-facing
  'case:read:assigned',
  'case:read:all',
  'case:triage',
  'case:assign:self',
  'case:assess',
  'case:update-status',
  'case:message',
  'callback:manage',
  'farmer-contact:reveal',
  'ai-feedback:create',
  'knowledge:read',
  'knowledge:review',
  // Administration
  'case:assign',
  'callback:manage:all',
  'ai-feedback:review',
  'knowledge:manage',
  'reference:manage',
  'language:manage',
  'user:manage',
  'audit:read',
  'settings:manage',
  'metrics:read',
  'provider-health:read',
  'model-version:manage',
  'privacy-request:manage',
  'telephony:simulate',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const FARMER_PERMISSIONS: readonly Permission[] = [
  'case:create',
  'case:read:own',
  'case:message',
  'image:analyze',
  'assistant:use',
  'voice:use',
  'callback:create',
  'privacy-request:create',
];

const EXPERT_PERMISSIONS: readonly Permission[] = [
  'case:read:assigned',
  'case:triage',
  'case:assign:self',
  'case:assess',
  'case:update-status',
  'case:message',
  'callback:manage',
  'farmer-contact:reveal',
  'ai-feedback:create',
  'knowledge:read',
  'knowledge:review',
  'assistant:use',
  'voice:use',
];

export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  FARMER: FARMER_PERMISSIONS,
  EXPERT: EXPERT_PERMISSIONS,
  ADMIN: PERMISSIONS,
};

/** Permissions an administrator may grant on top of a role (never to farmers). */
export const GRANTABLE_EXTRA_PERMISSIONS: readonly Permission[] = [
  'case:read:all',
  'case:assign',
  'callback:manage:all',
  'ai-feedback:review',
  'knowledge:manage',
  'reference:manage',
  'metrics:read',
  'provider-health:read',
  'telephony:simulate',
];

export function resolvePermissions(role: Role, extra: readonly string[] = []): Set<Permission> {
  const granted = new Set<Permission>(ROLE_PERMISSIONS[role]);
  if (role !== 'FARMER') {
    for (const p of extra) {
      if ((GRANTABLE_EXTRA_PERMISSIONS as readonly string[]).includes(p)) granted.add(p as Permission);
    }
  }
  return granted;
}
