import { z } from 'zod';
import { defineSection, envKey32, envPositiveInt, envSecret } from '../helpers.js';

export const securitySection = defineSection({
  name: 'security',
  schema: z.object({
    /** AES-256-GCM key for encrypting personal fields at rest (phone numbers). Base64, 32 bytes. */
    DATA_ENCRYPTION_KEY: envKey32,
    /** HMAC key used to build lookup hashes of personal fields (so phone numbers can be searched without storing them in clear). */
    DATA_HASH_KEY: envSecret(32),
    RATE_LIMIT_WINDOW_MS: envPositiveInt.default(60_000),
    /** General per-IP limit per window across the API. */
    RATE_LIMIT_MAX: envPositiveInt.default(300),
    /** Login/registration attempts per IP per 15 minutes. */
    AUTH_RATE_LIMIT_MAX: envPositiveInt.default(20),
    /** AI-backed requests (assistant, image analysis, voice) per user per minute. */
    AI_RATE_LIMIT_PER_MINUTE: envPositiveInt.default(10),
    /** Telephony webhook requests per IP per minute. */
    WEBHOOK_RATE_LIMIT_PER_MINUTE: envPositiveInt.default(600),
  }),
  map: (e) => ({
    dataEncryptionKey: e.DATA_ENCRYPTION_KEY,
    dataHashKey: e.DATA_HASH_KEY,
    rateLimitWindowMs: e.RATE_LIMIT_WINDOW_MS,
    rateLimitMax: e.RATE_LIMIT_MAX,
    authRateLimitMax: e.AUTH_RATE_LIMIT_MAX,
    aiRateLimitPerMinute: e.AI_RATE_LIMIT_PER_MINUTE,
    webhookRateLimitPerMinute: e.WEBHOOK_RATE_LIMIT_PER_MINUTE,
  }),
});

export type SecurityConfig = ReturnType<typeof securitySection.map>;
