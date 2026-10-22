import { z } from 'zod';
import { defineSection, envBool, envPositiveInt } from '../helpers.js';

export const databaseSection = defineSection({
  name: 'database',
  schema: z.object({
    MONGODB_URI: z
      .string({ error: 'MONGODB_URI is required' })
      .regex(/^mongodb(\+srv)?:\/\//, 'must be a mongodb:// or mongodb+srv:// connection string'),
    MONGODB_MAX_POOL_SIZE: envPositiveInt.default(10),
    MONGODB_SERVER_SELECTION_TIMEOUT_MS: envPositiveInt.default(10_000),
    /** Build indexes automatically on startup. Run `npm run db:indexes` explicitly when disabled. */
    MONGODB_AUTO_INDEX: envBool.optional(),
  }),
  map: (e) => ({
    uri: e.MONGODB_URI,
    maxPoolSize: e.MONGODB_MAX_POOL_SIZE,
    serverSelectionTimeoutMs: e.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
    autoIndex: e.MONGODB_AUTO_INDEX ?? true,
  }),
});

export type DatabaseConfig = ReturnType<typeof databaseSection.map>;
