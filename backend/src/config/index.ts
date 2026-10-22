import { type z } from 'zod';
import { cleanEnv, type ConfigSection, type NodeEnv, type SectionContext } from './helpers.js';
import { aiSection, type AiConfig } from './sections/ai.js';
import { authSection, type AuthConfig } from './sections/auth.js';
import { coreSection, type CoreConfig } from './sections/core.js';
import { databaseSection, type DatabaseConfig } from './sections/database.js';
import { imageModelSection, type ImageModelConfig } from './sections/image-model.js';
import { retentionSection, type RetentionConfig } from './sections/retention.js';
import { securitySection, type SecurityConfig } from './sections/security.js';
import { speechSection, type SpeechConfig } from './sections/speech.js';
import { storageSection, type StorageConfig } from './sections/storage.js';
import { telephonySection, type TelephonyConfig } from './sections/telephony.js';

export interface AppConfig {
  core: CoreConfig;
  database: DatabaseConfig;
  auth: AuthConfig;
  security: SecurityConfig;
  storage: StorageConfig;
  ai: AiConfig;
  imageModel: ImageModelConfig;
  speech: SpeechConfig;
  telephony: TelephonyConfig;
  retention: RetentionConfig;
}

export class ConfigValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid configuration:\n  - ${issues.join('\n  - ')}`);
    this.name = 'ConfigValidationError';
  }
}

function parseSection<S extends z.ZodType, C>(
  section: ConfigSection<S, C>,
  env: Record<string, string>,
  ctx: SectionContext,
  issues: string[],
): C | undefined {
  const result = section.schema.safeParse(env);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || section.name;
      // Never echo values: only the variable name and the rule it broke.
      issues.push(`${key}: ${issue.message}`);
    }
    return undefined;
  }
  const config = section.map(result.data, ctx);
  if (section.validate) issues.push(...section.validate(config, ctx));
  return config;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

/**
 * Load and validate all configuration from the environment. Throws a
 * ConfigValidationError listing every problem (without values) so a
 * misconfigured deployment fails fast at startup.
 */
export function loadConfig(rawEnv: NodeJS.ProcessEnv = process.env): AppConfig {
  const env = cleanEnv(rawEnv);
  const nodeEnvRaw = env.NODE_ENV ?? 'development';
  const nodeEnv: NodeEnv = nodeEnvRaw === 'production' || nodeEnvRaw === 'test' ? nodeEnvRaw : 'development';
  const ctx: SectionContext = { nodeEnv, isProduction: nodeEnv === 'production' };
  const issues: string[] = [];

  const config = {
    core: parseSection(coreSection, env, ctx, issues),
    database: parseSection(databaseSection, env, ctx, issues),
    auth: parseSection(authSection, env, ctx, issues),
    security: parseSection(securitySection, env, ctx, issues),
    storage: parseSection(storageSection, env, ctx, issues),
    ai: parseSection(aiSection, env, ctx, issues),
    imageModel: parseSection(imageModelSection, env, ctx, issues),
    speech: parseSection(speechSection, env, ctx, issues),
    telephony: parseSection(telephonySection, env, ctx, issues),
    retention: parseSection(retentionSection, env, ctx, issues),
  };

  if (issues.length > 0) throw new ConfigValidationError(issues);
  return deepFreeze(config as AppConfig);
}

/**
 * Non-secret summary for the startup log and the admin "service settings" view:
 * which providers are active — never keys, URIs or secrets.
 */
export function describeConfig(config: AppConfig): Record<string, unknown> {
  return {
    nodeEnv: config.core.nodeEnv,
    port: config.core.port,
    publicBaseUrl: config.core.publicBaseUrl,
    frontendOrigins: config.core.frontendOrigins,
    trustProxy: config.core.trustProxy,
    storageProvider: config.storage.provider,
    aiProvider: config.ai.provider,
    aiModel: config.ai.provider === 'gemini' ? config.ai.gemini.model : undefined,
    imageModelProvider: config.imageModel.provider,
    sttProvider: config.speech.sttProvider,
    ttsProvider: config.speech.ttsProvider,
    telephonyProvider: config.telephony.provider,
    telephonySimulatorEnabled: config.telephony.simulatorEnabled,
    apiDocsEnabled: config.core.apiDocsEnabled,
  };
}

export type { NodeEnv } from './helpers.js';
