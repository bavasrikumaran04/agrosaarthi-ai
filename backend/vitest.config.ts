import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    // One in-memory MongoDB server is started for the whole run; every test file
    // connects to its own uniquely named database (see test/helpers/db.ts).
    globalSetup: ['test/global-setup.ts'],
    setupFiles: ['test/setup-env.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    pool: 'forks',
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/__tests__/**', 'src/scripts/**'],
      reporter: ['text-summary', 'html'],
    },
  },
});
