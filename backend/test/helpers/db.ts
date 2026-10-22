import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, inject } from 'vitest';
import '../../src/db/models/index.js';

/** A database name unique to this test file (and process). */
export function uniqueTestDatabaseUri(): string {
  const url = new URL(inject('mongoUri'));
  url.pathname = `/t_${process.pid}_${Math.random().toString(36).slice(2, 10)}`;
  return url.toString();
}

export async function clearDatabase(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;
  const collections = await db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

/**
 * Connect mongoose to an isolated database for the current test file, build
 * all indexes (unique constraints are part of what we test), and drop the
 * database afterwards.
 */
export function useTestDatabase(options: { clearBetweenTests?: boolean } = {}): void {
  beforeAll(async () => {
    const uri = uniqueTestDatabaseUri();
    process.env.MONGODB_URI = uri;
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15_000 });
    await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
  });
  if (options.clearBetweenTests) {
    afterEach(async () => {
      await clearDatabase();
    });
  }
  afterAll(async () => {
    try {
      await mongoose.connection.dropDatabase();
    } finally {
      await mongoose.disconnect();
    }
  });
}
