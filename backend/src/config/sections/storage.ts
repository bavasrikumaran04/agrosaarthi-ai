import { z } from 'zod';
import { defineSection, envBool, envPositiveInt, envSecret } from '../helpers.js';

export const storageSection = defineSection({
  name: 'storage',
  schema: z.object({
    /** local = filesystem (development, or hosts with a persistent disk); s3 = any S3-compatible private bucket. */
    STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
    LOCAL_STORAGE_DIR: z.string().default('./storage'),
    /** Explicit opt-in to local storage in production (only on hosts with a persistent, backed-up disk). */
    ALLOW_LOCAL_STORAGE_IN_PRODUCTION: envBool.optional(),
    /** HMAC secret for short-lived signed URLs served by this API (local storage and telephony audio). */
    SIGNED_URL_SECRET: envSecret(32),
    SIGNED_URL_TTL_SECONDS: envPositiveInt.max(3600).default(300),
    S3_BUCKET: z.string().optional(),
    S3_REGION: z.string().optional(),
    /** Custom endpoint for S3-compatible services (e.g. Cloudflare R2, MinIO). Leave unset for AWS S3. */
    S3_ENDPOINT: z.url().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: envBool.optional(),
  }),
  map: (e) => ({
    provider: e.STORAGE_PROVIDER,
    localDir: e.LOCAL_STORAGE_DIR,
    allowLocalInProduction: e.ALLOW_LOCAL_STORAGE_IN_PRODUCTION ?? false,
    signedUrlSecret: e.SIGNED_URL_SECRET,
    signedUrlTtlSeconds: e.SIGNED_URL_TTL_SECONDS,
    s3: {
      bucket: e.S3_BUCKET,
      region: e.S3_REGION,
      endpoint: e.S3_ENDPOINT,
      accessKeyId: e.S3_ACCESS_KEY_ID,
      secretAccessKey: e.S3_SECRET_ACCESS_KEY,
      forcePathStyle: e.S3_FORCE_PATH_STYLE ?? false,
    },
  }),
  validate: (c, ctx) => {
    const issues: string[] = [];
    if (c.provider === 's3') {
      for (const [key, value] of Object.entries({
        S3_BUCKET: c.s3.bucket,
        S3_REGION: c.s3.region,
        S3_ACCESS_KEY_ID: c.s3.accessKeyId,
        S3_SECRET_ACCESS_KEY: c.s3.secretAccessKey,
      })) {
        if (!value) issues.push(`${key} is required when STORAGE_PROVIDER=s3`);
      }
    }
    if (ctx.isProduction && c.provider === 'local' && !c.allowLocalInProduction) {
      issues.push(
        'STORAGE_PROVIDER=local is not allowed in production (ephemeral disks lose farmer uploads). ' +
          'Use STORAGE_PROVIDER=s3, or set ALLOW_LOCAL_STORAGE_IN_PRODUCTION=true only on a persistent, backed-up disk.',
      );
    }
    return issues;
  },
});

export type StorageConfig = ReturnType<typeof storageSection.map>;
