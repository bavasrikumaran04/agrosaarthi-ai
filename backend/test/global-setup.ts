import { MongoMemoryServer } from 'mongodb-memory-server';
import type { TestProject } from 'vitest/node';

/**
 * Starts ONE in-memory MongoDB server (a real mongod binary managed by
 * mongodb-memory-server) for the whole test run. Each test file connects to
 * its own uniquely named database on it — see test/helpers/db.ts.
 * Tests never touch a development or production database.
 */
let mongod: MongoMemoryServer | undefined;

export async function setup(project: TestProject): Promise<void> {
  mongod = await MongoMemoryServer.create();
  project.provide('mongoUri', mongod.getUri());
}

export async function teardown(): Promise<void> {
  await mongod?.stop();
}

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string;
  }
}
