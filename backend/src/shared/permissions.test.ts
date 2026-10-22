import { describe, expect, it } from 'vitest';
import { PERMISSIONS, resolvePermissions, ROLE_PERMISSIONS } from './permissions.js';

describe('role permissions', () => {
  it('farmers cannot read other cases, manage users or view audit logs', () => {
    const p = resolvePermissions('FARMER');
    expect(p.has('case:read:own')).toBe(true);
    expect(p.has('case:read:all')).toBe(false);
    expect(p.has('case:read:assigned')).toBe(false);
    expect(p.has('user:manage')).toBe(false);
    expect(p.has('audit:read')).toBe(false);
  });

  it('experts see assigned cases but not all cases by default', () => {
    const p = resolvePermissions('EXPERT');
    expect(p.has('case:read:assigned')).toBe(true);
    expect(p.has('case:assess')).toBe(true);
    expect(p.has('case:read:all')).toBe(false);
    expect(p.has('user:manage')).toBe(false);
  });

  it('administrators hold every permission', () => {
    expect(resolvePermissions('ADMIN').size).toBe(PERMISSIONS.length);
    expect(ROLE_PERMISSIONS.ADMIN).toEqual(PERMISSIONS);
  });

  it('only grantable extras are added, and never to farmers', () => {
    const expert = resolvePermissions('EXPERT', ['case:read:all', 'user:manage', 'not-a-permission']);
    expect(expert.has('case:read:all')).toBe(true);
    expect(expert.has('user:manage')).toBe(false);
    const farmer = resolvePermissions('FARMER', ['case:read:all']);
    expect(farmer.has('case:read:all')).toBe(false);
  });
});
