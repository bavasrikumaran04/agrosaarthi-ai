import { readFileSync } from 'node:fs';
import { Router, type Express } from 'express';
import { createApp, type MountedRouter } from './app.js';
import type { AppConfig } from './config/index.js';
import { createCoreContainer, type CoreContainer } from './container.js';
import { sendOk } from './lib/http.js';
import type { Logger } from './lib/logger.js';
import { route } from './lib/route.js';
import { createAdminRouter } from './modules/admin/admin.routes.js';
import { AUTH_BASE_PATH, createAuthRouter } from './modules/auth/auth.routes.js';
import { createCasesRouter } from './modules/cases/cases.routes.js';
import { createCasesService, type CasesService } from './modules/cases/cases.service.js';
import { createSignedFilesRouter } from './modules/files/files.routes.js';
import { createFilesService, type FilesService } from './modules/files/files.service.js';
import { createHealthRouter, type ProviderStatusSource } from './modules/health/health.routes.js';
import { createImageAnalysisRouter } from './modules/image-analysis/image-analysis.routes.js';
import { createImageAnalysisService, type ImageAnalysisService } from './modules/image-analysis/image-analysis.service.js';
import { createReferenceRouter } from './modules/reference/reference.routes.js';
import { createReferenceService, type ReferenceService } from './modules/reference/reference.service.js';
import { createModelServiceAdapter, createSimulatedModel, type CropDiseaseModel } from './providers/image-model/image-model.js';
import { createObjectStorage, type ObjectStorage } from './providers/storage/index.js';
import { DISEASES } from './scripts/seed-data/reference.js';
import type { GuidancePort, KnowledgeRetriever } from './shared/ports.js';

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
    telephonySimulator: { provider: 'simulator', mode: config.telephony.simulatorEnabled ? ('simulated' as const) : ('disabled' as const) },
    storage: { provider: config.storage.provider, mode: 'live' },
  };
}

export function createImageModel(config: AppConfig): CropDiseaseModel | null {
  switch (config.imageModel.provider) {
    case 'model-service':
      return createModelServiceAdapter(config.imageModel);
    case 'simulated':
      return createSimulatedModel(DISEASES.map((d) => ({ classKey: d.modelClassKeys[0]!, cropKey: d.cropKey, diseaseKey: d.key, label: d.en })));
    default:
      return null;
  }
}

export interface AppServices {
  storage: ObjectStorage;
  files: FilesService;
  reference: ReferenceService;
  cases: CasesService;
  imageModel: CropDiseaseModel | null;
  imageAnalysis: ImageAnalysisService;
}

export interface BuiltApplication {
  app: Express;
  core: CoreContainer;
  services: AppServices;
  onShutdown: () => Promise<void>;
}

/** Hooks used by tests to mount extra routers or replace providers. */
export interface ExtraMounts {
  routes?: (core: CoreContainer) => MountedRouter[];
  webhooks?: (core: CoreContainer) => MountedRouter[];
  imageModel?: CropDiseaseModel | null;
  retriever?: KnowledgeRetriever;
  guidance?: GuidancePort;
}

/** Compose services and routers into the Express application (database must already be connected). */
export async function buildApplication(
  config: AppConfig,
  logger: Logger,
  overrides: Partial<CoreContainer> = {},
  extra: ExtraMounts = {},
): Promise<BuiltApplication> {
  const core = createCoreContainer(config, logger, overrides);
  await core.languages.ensureBaseline();

  const storage = createObjectStorage(config, core.clock);
  const files = createFilesService({ storage, retention: config.retention, signedUrlTtlSeconds: config.storage.signedUrlTtlSeconds, clock: core.clock, logger });
  const reference = createReferenceService();
  await reference.ensureSeeded();
  const cases = createCasesService({ clock: core.clock, audit: core.audit, decryptPhone: (e) => core.protector.cipher.decrypt(e) });
  const imageModel = extra.imageModel !== undefined ? extra.imageModel : createImageModel(config);
  const imageAnalysis = createImageAnalysisService({
    model: imageModel,
    files,
    cases,
    reference,
    retriever: extra.retriever,
    guidance: extra.guidance,
    clock: core.clock,
    logger,
    limits: { maxPixels: config.imageModel.maxPixels, minDimension: config.imageModel.minDimension },
  });

  const providers: ProviderStatusSource = { describeProviders: () => describeProvidersFromConfig(config) };
  const auth = core.authMiddleware;

  const languagesRouter = Router();
  languagesRouter.get('/', route({}, async ({ res }) => sendOk(res, await core.languages.listEnabled())));

  const app = createApp({
    config,
    logger,
    auth,
    unthrottled: [{ path: '/api/health', router: createHealthRouter({ version: readAppVersion(), startedAt: new Date(), providers }) }],
    webhooks: [...(extra.webhooks?.(core) ?? [])],
    routes: [
      { path: AUTH_BASE_PATH, router: createAuthRouter({ config, auth, service: core.authService }) },
      { path: '/api/v1/languages', router: languagesRouter },
      { path: '/api/v1', router: createReferenceRouter({ service: reference, auth, audit: core.audit }) },
      { path: '/api/v1/cases', router: createCasesRouter({ service: cases, auth, languages: core.languages }) },
      {
        path: '/api/v1/image-analysis',
        router: createImageAnalysisRouter({ service: imageAnalysis, auth, languages: core.languages, maxBytes: config.imageModel.maxBytes, perMinute: config.security.aiRateLimitPerMinute }),
      },
      { path: '/api/v1/files', router: createSignedFilesRouter({ storage, files }) },
      {
        path: '/api/v1/admin',
        router: createAdminRouter({
          auth,
          audit: core.audit,
          hasher: core.hasher,
          passwordMinLength: config.auth.passwordMinLength,
          providers,
          providerChecks: async () => ({
            storage: await storage.healthCheck(),
            imageModel: imageModel ? await imageModel.health() : { ok: false, detail: 'not configured' },
          }),
        }),
      },
      ...(extra.routes?.(core) ?? []),
    ],
  });

  return { app, core, services: { storage, files, reference, cases, imageModel, imageAnalysis }, onShutdown: async () => {} };
}
