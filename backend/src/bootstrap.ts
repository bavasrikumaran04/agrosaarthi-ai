import { readFileSync } from 'node:fs';
import type { Express } from 'express';
import { createApp } from './app.js';
import type { AppConfig } from './config/index.js';
import { createCoreContainer, type CoreContainer } from './container.js';
import type { Logger } from './lib/logger.js';
import { AUTH_BASE_PATH, createAuthRouter } from './modules/auth/auth.routes.js';
import { createHealthRouter, type ProviderStatusSource } from './modules/health/health.routes.js';

export function readAppVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** Public-safe provider modes derived from configuration (no secrets). */
export function describeProvidersFromConfig(config: AppConfig): ReturnType<ProviderStatusSource['describeProviders']> {
  const mode = (name: string, simulatedNames: string[] = ['simulated', 'development']) =>
    name === 'none' ? ('disabled' as const) : simulatedNames.includes(name) ? ('simulated' as const) : ('live' as const);
  return {
    ai: { provider: config.ai.provider, mode: mode(config.ai.provider) },
    imageModel: { provider: config.imageModel.provider, mode: mode(config.imageModel.provider) },
    speechToText: { provider: config.speech.sttProvider, mode: mode(config.speech.sttProvider) },
    textToSpeech: { provider: config.speech.ttsProvider, mode: mode(config.speech.ttsProvider) },
    telephony: { provider: config.telephony.provider, mode: mode(config.telephony.provider) },
    telephonySimulator: {
      provider: 'simulator',
      mode: config.telephony.simulatorEnabled ? ('simulated' as const) : ('disabled' as const),
    },
    storage: { provider: config.storage.provider, mode: 'live' },
  };
}

export interface BuiltApplication {
  app: Express;
  core: CoreContainer;
  onShutdown: () => Promise<void>;
}

/** Compose services and routers into the Express application (database must already be connected). */
export async function buildApplication(
  config: AppConfig,
  logger: Logger,
  overrides: Partial<CoreContainer> = {},
): Promise<BuiltApplication> {
  const core = createCoreContainer(config, logger, overrides);
  await core.languages.ensureBaseline();

  const providers: ProviderStatusSource = { describeProviders: () => describeProvidersFromConfig(config) };

  const app = createApp({
    config,
    logger,
    auth: core.authMiddleware,
    unthrottled: [
      { path: '/api/health', router: createHealthRouter({ version: readAppVersion(), startedAt: new Date(), providers }) },
    ],
    routes: [{ path: AUTH_BASE_PATH, router: createAuthRouter({ config, auth: core.authMiddleware, service: core.authService }) }],
  });

  return { app, core, onShutdown: async () => {} };
}
