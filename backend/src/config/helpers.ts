import { z } from 'zod';

export type NodeEnv = 'development' | 'test' | 'production';

export interface SectionContext {
  nodeEnv: NodeEnv;
  isProduction: boolean;
}

/**
 * A config section validates a slice of environment variables and maps them
 * into a typed, camelCase config object. `validate` adds cross-field checks
 * (most importantly the production guards that forbid simulated providers).
 */
export interface ConfigSection<S extends z.ZodType, C> {
  name: string;
  schema: S;
  map: (parsed: z.output<S>, ctx: SectionContext) => C;
  validate?: (config: C, ctx: SectionContext) => string[];
}

export function defineSection<S extends z.ZodType, C>(section: ConfigSection<S, C>): ConfigSection<S, C> {
  return section;
}

const TRUE_VALUES = new Set(['true', '1', 'yes', 'on']);
const BOOL_VALUES = ['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'] as const;

/** "true"/"false"/"1"/"0"/"yes"/"no" -> boolean. Use `.optional()` and resolve defaults in `map`. */
export const envBool = z
  .string()
  .transform((v) => v.toLowerCase())
  .pipe(z.enum(BOOL_VALUES))
  .transform((v) => TRUE_VALUES.has(v));

/** Comma-separated list -> string[] (empty entries dropped). */
export const envList = z
  .string()
  .transform((s) => s.split(',').map((x) => x.trim()).filter((x) => x.length > 0));

export const envPort = z.coerce.number().int().min(1).max(65535);
export const envPositiveInt = z.coerce.number().int().positive();
export const envNonNegativeInt = z.coerce.number().int().min(0);

export function envSecret(minLength: number) {
  return z.string().min(minLength, `must be at least ${minLength} characters`);
}

/** Base64-encoded 32-byte key (AES-256). */
export const envKey32 = z.string().refine(
  (s) => {
    try {
      return Buffer.from(s, 'base64').length === 32;
    } catch {
      return false;
    }
  },
  { message: 'must be a base64-encoded 32-byte key (see docs/ENVIRONMENT_VARIABLES.md for how to generate one)' },
);

/**
 * Drop unset/blank variables so `KEY=` in a .env file behaves like "not set".
 */
export function cleanEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string' && value.trim() !== '') out[key] = value.trim();
  }
  return out;
}

export function isLocalhostUrl(value: string): boolean {
  try {
    const { hostname } = new URL(value);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
  } catch {
    return false;
  }
}

export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}
