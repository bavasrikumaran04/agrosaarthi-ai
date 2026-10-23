import { z } from 'zod';
import { hmacSha256Base64Url, safeEqual } from '../../lib/crypto.js';

/**
 * Self-contained, short-lived download tokens for objects served by this API
 * (local storage). Format:
 *
 *   v1.<base64url(JSON {k: subject, e: expiry-unix-seconds})>.<base64url(HMAC-SHA256)>
 *
 * The MAC covers a context label plus the version and payload, so a token can
 * never be confused with another HMAC produced from the same secret. The
 * signature is checked (in constant time) BEFORE the payload is parsed.
 * Tokens carry no personal data, only the opaque storage key and the expiry.
 */
const VERSION = 'v1';
const CONTEXT = 'agrosaarthi:signed-object-url';
const MAX_TOKEN_LENGTH = 1024;
const TOKEN_SHAPE = /^v1\.[A-Za-z0-9_-]{1,900}\.[A-Za-z0-9_-]{43}$/;

const payloadSchema = z.strictObject({
  k: z.string().min(1).max(500),
  e: z.number().int().positive(),
});

export interface SignedTokenClaims {
  subject: string;
  expiresAt: Date;
}

export interface SignedTokenCodec {
  sign(subject: string, expiresAt: Date): string;
  /** Returns the claims, or null for any malformed, tampered or expired token (callers must not say which). */
  verify(token: string, now: Date): SignedTokenClaims | null;
}

export function createSignedTokenCodec(secret: string): SignedTokenCodec {
  if (secret.length < 32) throw new Error('The signed URL secret must be at least 32 characters');
  const mac = (payload: string) => hmacSha256Base64Url(secret, `${CONTEXT}|${VERSION}.${payload}`);

  return {
    sign(subject, expiresAt) {
      const body = JSON.stringify({ k: subject, e: Math.floor(expiresAt.getTime() / 1000) });
      const payload = Buffer.from(body, 'utf8').toString('base64url');
      return `${VERSION}.${payload}.${mac(payload)}`;
    },

    verify(token, now) {
      if (typeof token !== 'string' || token.length > MAX_TOKEN_LENGTH || !TOKEN_SHAPE.test(token)) return null;
      const [, payload, signature] = token.split('.');
      if (!payload || !signature || !safeEqual(mac(payload), signature)) return null;
      let decoded: unknown;
      try {
        decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      } catch {
        return null;
      }
      const claims = payloadSchema.safeParse(decoded);
      if (!claims.success) return null;
      const expiresAt = new Date(claims.data.e * 1000);
      if (expiresAt.getTime() <= now.getTime()) return null;
      return { subject: claims.data.k, expiresAt };
    },
  };
}
