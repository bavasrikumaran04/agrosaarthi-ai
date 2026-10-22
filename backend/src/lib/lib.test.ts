import { describe, expect, it, vi } from 'vitest';
import { createFieldCipher, createLookupHasher, safeEqual } from './crypto.js';
import { createPersonalDataProtector } from './personal-data.js';
import { maskPhone, normalizePhone } from './phone.js';
import { buildPaginationMeta, escapeRegex, paginationQuerySchema, toSkipLimit } from './pagination.js';
import {
  CircuitBreaker,
  CircuitOpenError,
  ConcurrencyLimitError,
  Semaphore,
  TimeoutError,
  withRetry,
  withTimeout,
} from './resilience.js';

const KEY = Buffer.alloc(32, 9).toString('base64');

describe('field cipher', () => {
  it('round-trips and uses a fresh IV per encryption', () => {
    const cipher = createFieldCipher(KEY);
    const a = cipher.encrypt('+919876543210');
    const b = cipher.encrypt('+919876543210');
    expect(a).not.toEqual(b);
    expect(a.startsWith('v1:')).toBe(true);
    expect(cipher.decrypt(a)).toBe('+919876543210');
  });

  it('detects tampering (GCM authentication)', () => {
    const cipher = createFieldCipher(KEY);
    const token = cipher.encrypt('secret value');
    const raw = Buffer.from(token.slice(3), 'base64url');
    raw[raw.length - 1] = raw[raw.length - 1]! ^ 0xff;
    expect(() => cipher.decrypt(`v1:${raw.toString('base64url')}`)).toThrow();
  });

  it('rejects keys of the wrong size', () => {
    expect(() => createFieldCipher(Buffer.alloc(16).toString('base64'))).toThrow();
  });
});

describe('lookup hashing and constant-time compare', () => {
  it('is deterministic per key and differs across keys', () => {
    const h1 = createLookupHasher('k'.repeat(32));
    const h2 = createLookupHasher('j'.repeat(32));
    expect(h1('+919876543210')).toBe(h1('+919876543210'));
    expect(h1('+919876543210')).not.toBe(h2('+919876543210'));
  });

  it('safeEqual handles different lengths', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('phone normalisation', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['+91 98765 43210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['+1 415 555 2671', '+14155552671'],
    ['0044 20 7946 0958', '+442079460958'],
  ])('normalises %s -> %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(['', '12345', 'abcdefghij', '1234567890', '+0123456789'])('rejects %s', (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it('masks to the last four digits', () => {
    expect(maskPhone('+919876543210')).toBe('******3210');
  });

  it('protector stores hash/ciphertext/last4 and the same farmer maps to the same hash', () => {
    const p = createPersonalDataProtector(KEY, 'h'.repeat(32));
    const a = p.protectPhone('98765 43210')!;
    const b = p.protectPhone('+919876543210')!;
    expect(a.hash).toBe(b.hash);
    expect(a.encrypted).not.toContain('9876543210');
    expect(a.last4).toBe('3210');
    expect(p.revealPhone(a)).toBe('+919876543210');
    expect(p.protectPhone('not a phone')).toBeNull();
  });
});

describe('pagination helpers', () => {
  it('applies defaults and bounds', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(paginationQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false);
    expect(toSkipLimit({ page: 3, pageSize: 10 })).toEqual({ skip: 20, limit: 10 });
    expect(buildPaginationMeta({ page: 1, pageSize: 20 }, 0).totalPages).toBe(1);
    expect(buildPaginationMeta({ page: 2, pageSize: 20 }, 41).totalPages).toBe(3);
  });

  it('escapes regex metacharacters from user input', () => {
    expect(new RegExp(escapeRegex('a.*b')).test('aXXb')).toBe(false);
    expect(new RegExp(escapeRegex('a.*b')).test('a.*b')).toBe(true);
  });
});

describe('withRetry', () => {
  it('retries retryable errors up to the limit, then throws', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('503'));
    await expect(withRetry(fn, { retries: 2, baseDelayMs: 1, isRetryable: () => true })).rejects.toThrow('503');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('400'));
    await expect(withRetry(fn, { retries: 5, baseDelayMs: 1, isRetryable: () => false })).rejects.toThrow('400');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('returns the first success', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValue('ok');
    await expect(withRetry(fn, { retries: 3, baseDelayMs: 1, isRetryable: () => true })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('withTimeout', () => {
  it('rejects with TimeoutError and aborts the signal', async () => {
    let aborted = false;
    const p = withTimeout(
      (signal) =>
        new Promise<string>((resolve) => {
          signal.addEventListener('abort', () => {
            aborted = true;
          });
          setTimeout(() => resolve('late'), 200);
        }),
      20,
      'slow op',
    );
    await expect(p).rejects.toBeInstanceOf(TimeoutError);
    expect(aborted).toBe(true);
  });

  it('resolves when fast enough', async () => {
    await expect(withTimeout(async () => 'fast', 100)).resolves.toBe('fast');
  });
});

describe('Semaphore', () => {
  it('limits concurrency and fails fast when the queue is full', async () => {
    const sem = new Semaphore('test', 1, 1);
    let release!: () => void;
    const first = sem.run(() => new Promise<void>((r) => (release = r)));
    const second = sem.run(async () => 'queued');
    await expect(sem.run(async () => 'overflow')).rejects.toBeInstanceOf(ConcurrencyLimitError);
    expect(sem.activeCount).toBe(1);
    release();
    await first;
    await expect(second).resolves.toBe('queued');
  });
});

describe('CircuitBreaker', () => {
  it('opens after consecutive failures and half-opens after the cooldown', async () => {
    let now = 0;
    const cb = new CircuitBreaker('provider', 2, 1000, () => now);
    const fail = () => Promise.reject(new Error('down'));
    await expect(cb.exec(fail)).rejects.toThrow('down');
    await expect(cb.exec(fail)).rejects.toThrow('down');
    expect(cb.currentState).toBe('OPEN');
    await expect(cb.exec(async () => 'x')).rejects.toBeInstanceOf(CircuitOpenError);
    now = 1500;
    expect(cb.currentState).toBe('HALF_OPEN');
    await expect(cb.exec(async () => 'recovered')).resolves.toBe('recovered');
    expect(cb.currentState).toBe('CLOSED');
  });

  it('re-opens if the half-open trial fails', async () => {
    let now = 0;
    const cb = new CircuitBreaker('provider', 1, 1000, () => now);
    await expect(cb.exec(() => Promise.reject(new Error('down')))).rejects.toThrow();
    now = 2000;
    await expect(cb.exec(() => Promise.reject(new Error('still down')))).rejects.toThrow();
    expect(cb.currentState).toBe('OPEN');
  });

  it('ignores errors that do not count as provider failures', async () => {
    const cb = new CircuitBreaker('provider', 1, 1000, () => 0);
    await expect(cb.exec(() => Promise.reject(new Error('bad input')), () => false)).rejects.toThrow();
    expect(cb.currentState).toBe('CLOSED');
  });
});
