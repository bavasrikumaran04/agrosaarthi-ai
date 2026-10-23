/**
 * Idempotent seed of reference data (crops, diseases, language registry baseline).
 * The API also runs this at startup; this script exists for explicit setups.
 *   npm run db:seed
 * No demo users or credentials are created here.
 */
import { existsSync } from 'node:fs';
import { loadConfig } from '../config/index.js';
import { connectDatabase, disconnectDatabase } from '../db/connection.js';
import { createSilentLogger } from '../lib/logger.js';
import { createLanguageRegistry } from '../modules/languages/language-registry.service.js';
import { createReferenceService } from '../modules/reference/reference.service.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const config = loadConfig();
const logger = createSilentLogger();
await connectDatabase(config.database, logger);
try {
  await createLanguageRegistry({ logger }).ensureBaseline();
  const r = await createReferenceService().ensureSeeded();
  console.log(`Seed complete: ${r.crops} crops and ${r.diseases} diseases inserted (existing records refreshed; admin edits kept).`);
} finally {
  await disconnectDatabase();
}
