import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { sanitizeAuditDetails } from './audit.service.js';

describe('sanitizeAuditDetails', () => {
  it('redacts sensitive keys at any depth', () => {
    const out = sanitizeAuditDetails({
      reason: 'bad-password',
      password: 'hunter2',
      nested: { phone: '+919876543210', apiKey: 'k', status: 'ok' },
    }) as Record<string, unknown>;
    expect(out.reason).toBe('bad-password');
    expect(out.password).toBe('[REDACTED]');
    expect(out.nested).toEqual({ phone: '[REDACTED]', apiKey: '[REDACTED]', status: 'ok' });
  });

  it('truncates long strings and limits depth and array size', () => {
    const out = sanitizeAuditDetails({ note: 'x'.repeat(500), list: Array.from({ length: 50 }, (_, i) => i) }) as {
      note: string;
      list: number[];
    };
    expect(out.note.length).toBeLessThanOrEqual(201);
    expect(out.list).toHaveLength(20);
    expect(sanitizeAuditDetails({ a: { b: { c: { d: { e: 1 } } } } })).toEqual({ a: { b: { c: { d: '[truncated]' } } } });
  });

  it('serialises ObjectIds and dates', () => {
    const id = new Types.ObjectId();
    const at = new Date('2026-10-22T00:00:00Z');
    expect(sanitizeAuditDetails({ id, at })).toEqual({ id: id.toHexString(), at: '2026-10-22T00:00:00.000Z' });
  });
});
