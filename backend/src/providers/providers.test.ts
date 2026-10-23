import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../config/index.js';
import { createModelServiceAdapter } from './image-model/image-model.js';
import { createLocalObjectStorage } from './storage/local-storage.js';
import { InvalidStorageKeyError, StorageObjectNotFoundError } from './storage/errors.js';
import { createSignedTokenCodec } from './storage/signed-token.js';
import { isValidStorageKey } from './storage/storage-key.js';

const clock = { now: () => new Date('2026-10-23T00:00:00Z') };

describe('storage keys', () => {
  it.each(['crop_image/2026/10/a.jpg', 'x', 'a_b.c-d/e'])('accepts %s', (k) => expect(isValidStorageKey(k)).toBe(true));
  it.each(['../etc/passwd', 'a/../b', '/abs', 'a\\b', 'C:/x', 'con.txt', '.hidden', 'a/', '', 'a:b', 'nul'])('rejects %s', (k) =>
    expect(isValidStorageKey(k)).toBe(false),
  );
});

describe('signed tokens', () => {
  const codec = createSignedTokenCodec('s'.repeat(40));
  it('round-trips and rejects tampering, expiry and other secrets', () => {
    const exp = new Date(clock.now().getTime() + 60_000);
    const tok = codec.sign('crop_image/a.jpg', exp);
    expect(codec.verify(tok, clock.now())?.subject).toBe('crop_image/a.jpg');
    expect(codec.verify(tok, new Date(exp.getTime() + 1))).toBeNull();
    expect(codec.verify(tok.slice(0, -2) + 'AA', clock.now())).toBeNull();
    expect(createSignedTokenCodec('t'.repeat(40)).verify(tok, clock.now())).toBeNull();
    expect(codec.verify('garbage', clock.now())).toBeNull();
  });
});

describe('local object storage', () => {
  const storage = createLocalObjectStorage({ baseDir: mkdtempSync(join(tmpdir(), 'st-')), signedUrlSecret: 'x'.repeat(40), publicBaseUrl: 'http://api.test', clock });
  it('puts, gets, signs and deletes', async () => {
    await storage.put('crop_image/2026/a.jpg', Buffer.from('hello'), { contentType: 'image/jpeg' });
    expect((await storage.get('crop_image/2026/a.jpg')).toString()).toBe('hello');
    const { url } = await storage.signedGetUrl('crop_image/2026/a.jpg', { ttlSeconds: 99999 });
    const token = url.split('/').pop()!;
    expect(url.startsWith('http://api.test/api/v1/files/signed/')).toBe(true);
    expect(storage.resolveSignedToken!(token)).toBe('crop_image/2026/a.jpg');
    await storage.delete('crop_image/2026/a.jpg');
    await storage.delete('crop_image/2026/a.jpg'); // idempotent
    await expect(storage.get('crop_image/2026/a.jpg')).rejects.toBeInstanceOf(StorageObjectNotFoundError);
    expect((await storage.healthCheck()).ok).toBe(true);
  });
  it('refuses traversal keys', async () => {
    await expect(storage.put('../escape.txt', Buffer.from('x'), { contentType: 'text/plain' })).rejects.toBeInstanceOf(InvalidStorageKeyError);
  });
});

describe('model-service adapter', () => {
  const cfg = loadConfig({ ...process.env, IMAGE_MODEL_PROVIDER: 'model-service', MODEL_SERVICE_URL: 'http://model.test', MODEL_SERVICE_TOKEN: 'token-0123456789abcdef' }).imageModel;
  const body = {
    model: { name: 'm', version: '1' },
    predictions: [{ classKey: 'Tomato___healthy', label: 'Tomato healthy', score: 0.9 }],
    uncertainty: { maxProbability: 0.9, margin: 0.8, abstain: false, reasons: [] },
    outOfDomain: { flagged: false, score: 1, threshold: 5, method: 'mahalanobis' },
    quality: { ok: true, issues: [], metrics: {} },
    inferenceMs: 3,
  };

  it('sends the image with the bearer token and normalises the response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    const r = await createModelServiceAdapter(cfg, fetchMock).predict(Buffer.from('img'), 'image/jpeg');
    expect(r).toMatchObject({ provider: 'model-service', simulated: false, model: { name: 'm' } });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://model.test/v1/predict');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-0123456789abcdef');
  });

  it('retries once on 503 then reports SERVICE_UNAVAILABLE', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"error":{"code":"BUSY"}}', { status: 503 }));
    await expect(createModelServiceAdapter(cfg, fetchMock).predict(Buffer.from('i'), 'image/jpeg')).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('maps invalid-image rejections to 422 without retrying', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"error":{"code":"INVALID_IMAGE"}}', { status: 400 }));
    await expect(createModelServiceAdapter(cfg, fetchMock).predict(Buffer.from('i'), 'image/jpeg')).rejects.toMatchObject({ status: 422 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed responses instead of trusting them', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"predictions":[]}', { status: 200 }));
    await expect(createModelServiceAdapter(cfg, fetchMock).predict(Buffer.from('i'), 'image/jpeg')).rejects.toMatchObject({ status: 502 });
  });
});
