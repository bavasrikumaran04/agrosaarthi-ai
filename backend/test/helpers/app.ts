import supertest from 'supertest';
import { buildApplication, type BuiltApplication } from '../../src/bootstrap.js';
import { loadConfig, type AppConfig } from '../../src/config/index.js';
import type { CoreContainer } from '../../src/container.js';
import { createSilentLogger } from '../../src/lib/logger.js';

export interface TestApplication extends BuiltApplication {
  config: AppConfig;
  http: () => supertest.Agent;
}

/** Build the full application against the already-connected test database. */
export async function createTestApplication(
  envOverrides: Record<string, string> = {},
  coreOverrides: Partial<CoreContainer> = {},
): Promise<TestApplication> {
  const config = loadConfig({ ...process.env, ...envOverrides });
  const built = await buildApplication(config, createSilentLogger(), coreOverrides);
  return { ...built, config, http: () => supertest.agent(built.app) };
}

/** Load config from the test environment plus overrides (no app). */
export function testConfig(envOverrides: Record<string, string> = {}): AppConfig {
  return loadConfig({ ...process.env, ...envOverrides });
}
