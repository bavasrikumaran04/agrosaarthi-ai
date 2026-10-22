import mongoose from 'mongoose';
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestApplication, type TestApplication } from '../test/helpers/app.js';
import { useTestDatabase } from '../test/helpers/db.js';
import { toAppError } from './middleware/error-handler.js';

useTestDatabase();

let t: TestApplication;
beforeAll(async () => {
  t = await createTestApplication();
});

describe('HTTP hardening', () => {
  it('sets security headers and echoes/creates request ids', async () => {
    const res = await t.http().get('/api/health/live');
    expect(res.status).toBe(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    const echoed = await t.http().get('/api/health/live').set('X-Request-Id', 'client-req-12345');
    expect(echoed.headers['x-request-id']).toBe('client-req-12345');
    const unsafe = await t.http().get('/api/health/live').set('X-Request-Id', 'bad id with spaces');
    expect(unsafe.headers['x-request-id']).not.toBe('bad id with spaces');
  });

  it('allows CORS only for allowlisted origins', async () => {
    const ok = await t.http().options('/api/v1/auth/login').set('Origin', 'http://localhost:4200').set('Access-Control-Request-Method', 'POST');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:4200');
    expect(ok.headers['access-control-allow-credentials']).toBe('true');
    const evil = await t.http().options('/api/v1/auth/login').set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'POST');
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('returns a consistent error envelope for unknown routes and malformed JSON', async () => {
    const missing = await t.http().get('/api/v1/does-not-exist');
    expect(missing.status).toBe(404);
    expect(missing.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
    expect(missing.body.meta.requestId).toEqual(expect.any(String));

    const malformed = await t.http().post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{"identifier": ');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('BAD_REQUEST');
    expect(JSON.stringify(malformed.body)).not.toContain('SyntaxError');
  });

  it('rejects NoSQL operator injection and prototype-pollution payloads', async () => {
    const injection = await t.http().post('/api/v1/auth/login').send({ identifier: { $gt: '' }, password: { $ne: null } });
    expect(injection.status).toBe(400);
    const pollution = await t.http().post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{"identifier":"a@b.c","password":"x","__proto__":{"admin":true}}');
    expect(pollution.status).toBe(400);
  });

  it('enforces the JSON body size limit', async () => {
    const res = await t.http().post('/api/v1/auth/login').send({ identifier: 'a@b.c', password: 'x'.repeat(200_000) });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('rate-limits with a 429 envelope', async () => {
    const limited = await createTestApplication({ AUTH_RATE_LIMIT_MAX: '2' });
    const agent = limited.http();
    await agent.post('/api/v1/auth/login').send({ identifier: 'x@y.z', password: 'aaaaaaaa' });
    await agent.post('/api/v1/auth/login').send({ identifier: 'x@y.z', password: 'aaaaaaaa' });
    const third = await agent.post('/api/v1/auth/login').send({ identifier: 'x@y.z', password: 'aaaaaaaa' });
    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('health probes', () => {
  it('reports readiness with database status and public-safe provider modes', async () => {
    const res = await t.http().get('/api/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ready');
    expect(res.body.data.checks.database.ok).toBe(true);
    expect(res.body.data.providers.ai).toEqual({ provider: 'none', mode: 'disabled' });
    expect(JSON.stringify(res.body)).not.toMatch(/mongodb:\/\/|secret/i);
  });
});

describe('error translation', () => {
  it('maps library errors to safe AppErrors', () => {
    expect(toAppError(new mongoose.Error.CastError('ObjectId', 'x', '_id')).status).toBe(400);
    expect(toAppError(Object.assign(new Error('dup'), { name: 'MongoServerError', code: 11000 })).code).toBe('CONFLICT');
    const internal = toAppError(new Error('connection string mongodb://user:pass@host leaked'));
    expect(internal.status).toBe(500);
    expect(internal.message).toBe('An unexpected error occurred');
  });
});

describe('readiness when the database is down', () => {
  it('returns 503 not_ready after disconnect', async () => {
    await mongoose.disconnect();
    try {
      const res = await t.http().get('/api/health/ready');
      expect(res.status).toBe(503);
      expect(res.body.data.status).toBe('not_ready');
      const live = await t.http().get('/api/health/live');
      expect(live.status).toBe(200);
    } finally {
      await mongoose.connect(process.env.MONGODB_URI!);
    }
  });
});
