import { z } from 'zod';
import { defineSection, envPositiveInt, envSecret } from '../helpers.js';

/**
 * Crop-disease image model.
 *  - model-service: the separate Python inference service (model-service/), called over HTTP.
 *  - simulated:     development SIMULATOR; results are labelled `simulated: true`. Forbidden in production.
 *  - none:          image analysis disabled (API returns 503 SERVICE_NOT_CONFIGURED).
 */
export const IMAGE_MODEL_PROVIDERS = ['model-service', 'simulated', 'none'] as const;
export type ImageModelProviderName = (typeof IMAGE_MODEL_PROVIDERS)[number];

export const imageModelSection = defineSection({
  name: 'imageModel',
  schema: z.object({
    IMAGE_MODEL_PROVIDER: z.enum(IMAGE_MODEL_PROVIDERS).default('none'),
    MODEL_SERVICE_URL: z.url().optional(),
    /** Shared secret sent as a bearer token to the model service. */
    MODEL_SERVICE_TOKEN: envSecret(16).optional(),
    MODEL_SERVICE_TIMEOUT_MS: envPositiveInt.max(120_000).default(20_000),
    IMAGE_MAX_BYTES: envPositiveInt.max(25 * 1024 * 1024).default(8 * 1024 * 1024),
    IMAGE_MIN_DIMENSION: envPositiveInt.default(128),
    /** Decompression-bomb guard: maximum decoded pixel count. */
    IMAGE_MAX_PIXELS: envPositiveInt.default(40_000_000),
  }),
  map: (e) => ({
    provider: e.IMAGE_MODEL_PROVIDER,
    serviceUrl: e.MODEL_SERVICE_URL?.replace(/\/+$/, ''),
    serviceToken: e.MODEL_SERVICE_TOKEN,
    timeoutMs: e.MODEL_SERVICE_TIMEOUT_MS,
    maxBytes: e.IMAGE_MAX_BYTES,
    minDimension: e.IMAGE_MIN_DIMENSION,
    maxPixels: e.IMAGE_MAX_PIXELS,
  }),
  validate: (c, ctx) => {
    const issues: string[] = [];
    if (c.provider === 'model-service') {
      if (!c.serviceUrl) issues.push('MODEL_SERVICE_URL is required when IMAGE_MODEL_PROVIDER=model-service');
      if (!c.serviceToken) issues.push('MODEL_SERVICE_TOKEN is required when IMAGE_MODEL_PROVIDER=model-service');
    }
    if (ctx.isProduction && c.provider === 'simulated') {
      issues.push('IMAGE_MODEL_PROVIDER=simulated is not allowed in production (use model-service or none)');
    }
    return issues;
  },
});

export type ImageModelConfig = ReturnType<typeof imageModelSection.map>;
