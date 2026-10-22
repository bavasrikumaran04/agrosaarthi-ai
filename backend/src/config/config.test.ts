import { describe, expect, it } from 'vitest';
import { ConfigValidationError, describeConfig, loadConfig } from './index.js';

const BASE: Record<string, string> = {
  NODE_ENV: 'development',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/agrosaarthi',
  JWT_ACCESS_SECRET: 'x'.repeat(40),
  DATA_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
  DATA_HASH_KEY: 'h'.repeat(40),
  SIGNED_URL_SECRET: 's'.repeat(40),
  TELEPHONY_SIMULATOR_SECRET: 't'.repeat(40),
};

const PROD: Record<string, string> = {
  ...BASE,
  NODE_ENV: 'production',
  PUBLIC_BASE_URL: 'https://api.agrosaarthi.example',
  FRONTEND_ORIGINS: 'https://app.agrosaarthi.example',
  STORAGE_PROVIDER: 's3',
  S3_BUCKET: 'bucket',
  S3_REGION: 'auto',
  S3_ACCESS_KEY_ID: 'id',
  S3_SECRET_ACCESS_KEY: 'secret',
  TELEPHONY_SIMULATOR_ENABLED: 'false',
};

function issuesOf(env: Record<string, string>): string[] {
  try {
    loadConfig(env);
    return [];
  } catch (err) {
    if (err instanceof ConfigValidationError) return err.issues;
    throw err;
  }
}

describe('loadConfig', () => {
  it('loads a valid development configuration with safe defaults', () => {
    const config = loadConfig(BASE);
    expect(config.core.port).toBe(4000);
    expect(config.core.frontendOrigins).toEqual(['http://localhost:4200']);
    expect(config.ai.provider).toBe('none');
    expect(config.imageModel.provider).toBe('none');
    expect(config.auth.cookieSecure).toBe(false);
    expect(Object.isFrozen(config.core)).toBe(true);
  });

  it('reports every missing required variable at once without echoing values', () => {
    const issues = issuesOf({ NODE_ENV: 'development', JWT_ACCESS_SECRET: 'short-secret-value' });
    const joined = issues.join('\n');
    expect(joined).toContain('MONGODB_URI');
    expect(joined).toContain('JWT_ACCESS_SECRET');
    expect(joined).toContain('DATA_ENCRYPTION_KEY');
    expect(joined).toContain('DATA_HASH_KEY');
    expect(joined).not.toContain('short-secret-value');
  });

  it('treats blank variables as unset', () => {
    expect(issuesOf({ ...BASE, GEMINI_API_KEY: '   ' })).toEqual([]);
    expect(loadConfig({ ...BASE, GEMINI_API_KEY: '' }).ai.gemini.apiKey).toBeUndefined();
  });

  it('rejects malformed origins and encryption keys', () => {
    expect(issuesOf({ ...BASE, FRONTEND_ORIGINS: 'http://localhost:4200/path' }).join()).toContain('FRONTEND_ORIGINS');
    expect(issuesOf({ ...BASE, DATA_ENCRYPTION_KEY: 'not-a-32-byte-key' }).join()).toContain('DATA_ENCRYPTION_KEY');
  });

  it('requires Gemini credentials and an explicit model when AI_PROVIDER=gemini', () => {
    const issues = issuesOf({ ...BASE, AI_PROVIDER: 'gemini' }).join('\n');
    expect(issues).toContain('GEMINI_API_KEY');
    expect(issues).toContain('GEMINI_MODEL');
  });

  it('requires model-service URL and token when IMAGE_MODEL_PROVIDER=model-service', () => {
    const issues = issuesOf({ ...BASE, IMAGE_MODEL_PROVIDER: 'model-service' }).join('\n');
    expect(issues).toContain('MODEL_SERVICE_URL');
    expect(issues).toContain('MODEL_SERVICE_TOKEN');
  });

  it('accepts a complete production configuration', () => {
    const config = loadConfig(PROD);
    expect(config.core.isProduction).toBe(true);
    expect(config.auth.cookieSecure).toBe(true);
    expect(config.core.apiDocsEnabled).toBe(false);
  });

  it.each([
    ['AI_PROVIDER', 'development'],
    ['IMAGE_MODEL_PROVIDER', 'simulated'],
    ['STT_PROVIDER', 'simulated'],
    ['TTS_PROVIDER', 'simulated'],
  ])('forbids simulators in production (%s=%s)', (key, value) => {
    expect(issuesOf({ ...PROD, [key]: value }).join('\n')).toMatch(new RegExp(key));
  });

  it('forbids the telephony simulator in production unless explicitly allowed', () => {
    expect(issuesOf({ ...PROD, TELEPHONY_SIMULATOR_ENABLED: 'true' }).join()).toContain('simulator');
    expect(issuesOf({ ...PROD, TELEPHONY_SIMULATOR_ENABLED: 'true', ALLOW_TELEPHONY_SIMULATOR_IN_PRODUCTION: 'true' })).toEqual([]);
  });

  it('forbids ephemeral local storage, http origins and missing public URL in production', () => {
    const { STORAGE_PROVIDER: _s, PUBLIC_BASE_URL: _p, ...rest } = PROD;
    const issues = issuesOf({ ...rest, FRONTEND_ORIGINS: 'http://localhost:4200' }).join('\n');
    expect(issues).toContain('STORAGE_PROVIDER=local');
    expect(issues).toContain('PUBLIC_BASE_URL is required');
    expect(issues).toContain('non-localhost https origin');
  });

  it('forbids insecure cookies and debug logging in production', () => {
    expect(issuesOf({ ...PROD, COOKIE_SECURE: 'false' }).join()).toContain('COOKIE_SECURE');
    expect(issuesOf({ ...PROD, LOG_LEVEL: 'debug' }).join()).toContain('LOG_LEVEL');
  });

  it('requires COOKIE_SECURE when SameSite=None', () => {
    expect(issuesOf({ ...BASE, COOKIE_SAMESITE: 'none' }).join()).toContain('COOKIE_SAMESITE=none');
  });

  it('describeConfig exposes provider names but never secrets', () => {
    const summary = JSON.stringify(describeConfig(loadConfig({ ...BASE, AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'AIza-secret-key', GEMINI_MODEL: 'some-model' })));
    expect(summary).toContain('gemini');
    expect(summary).not.toContain('AIza-secret-key');
    expect(summary).not.toContain(BASE.JWT_ACCESS_SECRET!);
    expect(summary).not.toContain('mongodb://');
  });
});
