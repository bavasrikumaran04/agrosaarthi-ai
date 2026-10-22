/**
 * DEVELOPMENT ONLY: run a local MongoDB without installing MongoDB, using the
 * mongod binary that mongodb-memory-server downloads (a real MongoDB server).
 * Data persists in backend/.dev-mongo-data between runs.
 *
 *   npm run dev:mongo            # listens on 127.0.0.1:27017
 *   DEV_MONGO_PORT=27018 npm run dev:mongo
 *
 * Production must use a managed MongoDB deployment (see docs/DEPLOYMENT.md).
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server';

const port = Number(process.env.DEV_MONGO_PORT ?? 27017);
const dbPath = resolve(process.cwd(), '.dev-mongo-data');
mkdirSync(dbPath, { recursive: true });

const server = await MongoMemoryServer.create({
  instance: { port, ip: '127.0.0.1', dbPath, storageEngine: 'wiredTiger' },
});

console.log(`Development MongoDB running at ${server.getUri()} (data: ${dbPath})`);
console.log('Set MONGODB_URI=mongodb://127.0.0.1:%d/agrosaarthi in backend/.env. Press Ctrl+C to stop.', port);

const stop = async () => {
  // Keep the data directory: doCleanup=false preserves dbPath contents.
  await server.stop({ doCleanup: false, force: false });
  process.exit(0);
};
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
