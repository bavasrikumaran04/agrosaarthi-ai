import { beforeAll, describe, expect, it } from 'vitest';
import { AuditLogModel } from '../../db/models/audit-log.model.js';
import { RefreshTokenModel } from '../../db/models/refresh-token.model.js';
import { UserModel } from '../../db/models/user.model.js';
import { PRIVACY_NOTICE_VERSION } from '../../shared/language-registry.js';
import { createTestApplication, type TestApplication } from '../../../test/helpers/app.js';
import { useTestDatabase } from '../../../test/helpers/db.js';
import { createUser } from '../../../test/helpers/factories.js';

useTestDatabase();

let t: TestApplication;
beforeAll(async () => {
  t = await createTestApplication({ LOGIN_MAX_FAILED_ATTEMPTS: '3' });
});

const CSRF = { 'X-CSRF-Protection': '1', Origin: 'http://localhost:4200' };

function registration(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Murugan',
    phone: '+91 90000 11111',
    password: 'paddy-field-2026',
    preferredLanguage: 'ta',
    district: 'Thanjavur',
    consent: { acceptPrivacyNotice: true, aiProcessing: true, privacyNoticeVersion: PRIVACY_NOTICE_VERSION },
    ...overrides,
  };
}

function refreshCookieFrom(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers['set-cookie'];
  const cookies = Array.isArray(raw) ? (raw as string[]) : [String(raw)];
  const c = cookies.find((x) => x.startsWith('as_refresh='));
  if (!c) throw new Error('no refresh cookie');
  return c.split(';')[0]!;
}

describe('farmer registration', () => {
  it('registers a farmer, stores no clear-text phone/password, and starts a session', async () => {
    const res = await t.http().post('/api/v1/auth/register').send(registration());
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.user).toMatchObject({ role: 'FARMER', name: 'Murugan', phoneMasked: '******1111', preferredLanguage: 'ta' });
    expect(res.body.data.user.permissions).toContain('image:analyze');
    const setCookie = String(res.headers['set-cookie']);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Path=/api/v1/auth');

    const stored = await UserModel.findOne({ name: 'Murugan' }).select('+passwordHash +phone.encrypted').lean();
    const json = JSON.stringify(stored);
    expect(json).not.toContain('9000011111');
    expect(json).not.toContain('paddy-field-2026');
    expect(stored?.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(stored?.consent?.aiProcessing).toBe(true);
  });

  it('rejects a duplicate phone number in any formatting', async () => {
    const res = await t.http().post('/api/v1/auth/register').send(registration({ phone: '09000011111' }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('requires consent, a valid phone and a non-trivial password', async () => {
    const noConsent = await t.http().post('/api/v1/auth/register').send(
      registration({ phone: '9000022222', consent: { acceptPrivacyNotice: true, aiProcessing: false, privacyNoticeVersion: PRIVACY_NOTICE_VERSION } }),
    );
    expect(noConsent.status).toBe(400);
    expect(noConsent.body.error.code).toBe('VALIDATION_ERROR');

    const badPhone = await t.http().post('/api/v1/auth/register').send(registration({ phone: '12345' }));
    expect(badPhone.status).toBe(400);

    const weak = await t.http().post('/api/v1/auth/register').send(registration({ phone: '9000033333', password: 'password' }));
    expect(weak.status).toBe(400);
    expect(JSON.stringify(weak.body.error.details)).toContain('Password');
  });

  it('rejects an outdated privacy notice version and unknown fields (mass assignment)', async () => {
    const old = await t.http().post('/api/v1/auth/register').send(
      registration({ phone: '9000044444', consent: { acceptPrivacyNotice: true, aiProcessing: true, privacyNoticeVersion: '2020-01-01' } }),
    );
    expect(old.status).toBe(400);
    const elevated = await t.http().post('/api/v1/auth/register').send(registration({ phone: '9000055555', role: 'ADMIN' }));
    expect(elevated.status).toBe(400);
    expect(await UserModel.exists({ role: 'ADMIN', name: 'Murugan' })).toBeNull();
  });

  it('rejects a disabled language', async () => {
    const res = await t.http().post('/api/v1/auth/register').send(registration({ phone: '9000066666', preferredLanguage: 'hi' }));
    expect(res.status).toBe(400);
  });
});

describe('login, lockout and sessions', () => {
  it('logs in a farmer by phone and a staff member by email', async () => {
    const farmer = await t.http().post('/api/v1/auth/login').send({ identifier: '90000 11111', password: 'paddy-field-2026' });
    expect(farmer.status).toBe(200);
    expect(farmer.body.data.user.role).toBe('FARMER');

    const expert = await createUser(t.core, { role: 'EXPERT', email: 'Expert.One@Example.test', password: 'expert-pass-2026' });
    const res = await t.http().post('/api/v1/auth/login').send({ identifier: 'expert.one@example.test', password: expert.password });
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('EXPERT');
  });

  it('uses one generic message for unknown accounts and wrong passwords', async () => {
    const unknown = await t.http().post('/api/v1/auth/login').send({ identifier: '9999999999', password: 'whatever-123' });
    const wrong = await t.http().post('/api/v1/auth/login').send({ identifier: '9000011111', password: 'wrong-password' });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.error.message).toBe(wrong.body.error.message);
  });

  it('locks the account after repeated failures and audits it', async () => {
    const victim = await createUser(t.core, { role: 'FARMER', password: 'correct-horse-1' });
    for (let i = 0; i < 3; i += 1) {
      await t.http().post('/api/v1/auth/login').send({ identifier: victim.phone, password: 'nope-nope-nope' });
    }
    const locked = await t.http().post('/api/v1/auth/login').send({ identifier: victim.phone, password: 'correct-horse-1' });
    expect(locked.status).toBe(423);
    expect(locked.body.error.code).toBe('ACCOUNT_LOCKED');
    expect(await AuditLogModel.exists({ action: 'auth.lockout', targetId: victim.id })).not.toBeNull();
  });

  it('refuses disabled accounts', async () => {
    const disabled = await createUser(t.core, { role: 'EXPERT', status: 'DISABLED', password: 'disabled-pass-1' });
    const res = await t.http().post('/api/v1/auth/login').send({ identifier: disabled.email, password: 'disabled-pass-1' });
    expect(res.status).toBe(403);
    const me = await t.http().get('/api/v1/auth/me').set('Authorization', disabled.authorization);
    expect(me.status).toBe(401);
  });

  it('rotates refresh tokens and revokes the family when a rotated token is replayed', async () => {
    const login = await t.http().post('/api/v1/auth/login').send({ identifier: '9000011111', password: 'paddy-field-2026' });
    const first = refreshCookieFrom(login);

    const rotated = await t.http().post('/api/v1/auth/refresh').set(CSRF).set('Cookie', first);
    expect(rotated.status).toBe(200);
    const second = refreshCookieFrom(rotated);
    expect(second).not.toBe(first);

    // Simulate theft: age the rotation past the grace window, then replay the old token.
    await RefreshTokenModel.updateMany({ revokedReason: 'rotated' }, { $set: { revokedAt: new Date(Date.now() - 60_000) } });
    const replay = await t.http().post('/api/v1/auth/refresh').set(CSRF).set('Cookie', first);
    expect(replay.status).toBe(401);
    const afterTheft = await t.http().post('/api/v1/auth/refresh').set(CSRF).set('Cookie', second);
    expect(afterTheft.status).toBe(401);
  });

  it('requires the CSRF header and an allowlisted origin for cookie-authenticated refresh', async () => {
    const login = await t.http().post('/api/v1/auth/login').send({ identifier: '9000011111', password: 'paddy-field-2026' });
    const cookie = refreshCookieFrom(login);
    const noHeader = await t.http().post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(noHeader.status).toBe(403);
    const badOrigin = await t.http().post('/api/v1/auth/refresh').set({ 'X-CSRF-Protection': '1', Origin: 'https://evil.example' }).set('Cookie', cookie);
    expect(badOrigin.status).toBe(403);
    const none = await t.http().post('/api/v1/auth/refresh').set(CSRF);
    expect(none.status).toBe(401);
  });

  it('logout revokes the refresh token', async () => {
    const login = await t.http().post('/api/v1/auth/login').send({ identifier: '9000011111', password: 'paddy-field-2026' });
    const cookie = refreshCookieFrom(login);
    const out = await t.http().post('/api/v1/auth/logout').set(CSRF).set('Cookie', cookie);
    expect(out.status).toBe(204);
    const again = await t.http().post('/api/v1/auth/refresh').set(CSRF).set('Cookie', cookie);
    expect(again.status).toBe(401);
  });

  it('password change invalidates previously issued access tokens', async () => {
    const user = await createUser(t.core, { role: 'FARMER', password: 'original-pass-1' });
    const ok = await t.http().get('/api/v1/auth/me').set('Authorization', user.authorization);
    expect(ok.status).toBe(200);
    const changed = await t.http()
      .post('/api/v1/auth/change-password')
      .set('Authorization', user.authorization)
      .send({ currentPassword: 'original-pass-1', newPassword: 'brand-new-pass-2' });
    expect(changed.status).toBe(200);
    const stale = await t.http().get('/api/v1/auth/me').set('Authorization', user.authorization);
    expect(stale.status).toBe(401);
    const fresh = await t.http().get('/api/v1/auth/me').set('Authorization', `Bearer ${changed.body.data.accessToken}`);
    expect(fresh.status).toBe(200);
  });

  it('lets a user update allowlisted profile fields only', async () => {
    const user = await createUser(t.core, { role: 'FARMER' });
    const res = await t.http().patch('/api/v1/auth/me').set('Authorization', user.authorization).send({ name: 'Selvi', district: 'Madurai' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'Selvi', district: 'Madurai', role: 'FARMER' });
    const escalate = await t.http().patch('/api/v1/auth/me').set('Authorization', user.authorization).send({ role: 'ADMIN' });
    expect(escalate.status).toBe(400);
  });
});

describe('access token handling', () => {
  it('rejects missing, malformed, forged and expired tokens', async () => {
    expect((await t.http().get('/api/v1/auth/me')).status).toBe(401);
    expect((await t.http().get('/api/v1/auth/me').set('Authorization', 'Token abc')).status).toBe(401);
    const forged =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAiLCJ0diI6MH0.c2lnbmF0dXJlLWZvcmdlZA';
    expect((await t.http().get('/api/v1/auth/me').set('Authorization', `Bearer ${forged}`)).status).toBe(401);

    const shortLived = await createTestApplication({ JWT_ACCESS_TTL_SECONDS: '1' });
    const user = await createUser(shortLived.core, { role: 'FARMER' });
    await new Promise((r) => setTimeout(r, 2100));
    expect((await shortLived.http().get('/api/v1/auth/me').set('Authorization', user.authorization)).status).toBe(401);
  });
});
