// Vercel serverless entry point: the same Express application as src/server.ts, built once per instance.
import { buildApplication } from '../dist/bootstrap.js';
import { loadConfig } from '../dist/config/index.js';
import { connectDatabase } from '../dist/db/connection.js';
import { createLogger } from '../dist/lib/logger.js';

let appPromise;

async function init() {
  const config = loadConfig();
  const logger = createLogger({ level: config.core.logLevel, pretty: false });
  await connectDatabase(config.database, logger);
  const { app } = await buildApplication(config, logger);
  return app;
}

export default async function handler(req, res) {
  appPromise ??= init().catch((err) => {
    appPromise = undefined; // retry on the next request (e.g. database briefly unreachable)
    throw err;
  });
  const app = await appPromise;
  return app(req, res);
}
