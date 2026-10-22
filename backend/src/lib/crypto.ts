import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Field-level encryption for personal data at rest (e.g. phone numbers).
 * AES-256-GCM; token format: "v1:" + base64url(iv[12] | tag[16] | ciphertext).
 */
export interface FieldCipher {
  encrypt(plaintext: string): string;
  decrypt(token: string): string;
}

export function createFieldCipher(keyBase64: string): FieldCipher {
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) throw new Error('Field cipher key must be 32 bytes');
  return {
    encrypt(plaintext: string): string {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      return `v1:${Buffer.concat([iv, tag, ciphertext]).toString('base64url')}`;
    },
    decrypt(token: string): string {
      if (!token.startsWith('v1:')) throw new Error('Unsupported ciphertext version');
      const raw = Buffer.from(token.slice(3), 'base64url');
      if (raw.length < 29) throw new Error('Ciphertext too short');
      const iv = raw.subarray(0, 12);
      const tag = raw.subarray(12, 28);
      const ciphertext = raw.subarray(28);
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    },
  };
}

/** Keyed hash for looking up personal values (phone numbers) without storing them in clear. */
export function createLookupHasher(key: string): (value: string) => string {
  return (value: string) => createHmac('sha256', key).update(value, 'utf8').digest('hex');
}

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function hmacSha256Base64Url(key: string, data: string): string {
  return createHmac('sha256', key).update(data, 'utf8').digest('base64url');
}

/** Cryptographically random URL-safe token (default 256 bits). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Constant-time comparison of two strings (false when lengths differ). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
