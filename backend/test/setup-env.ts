/**
 * Deterministic, obviously-fake configuration for tests. These values are not
 * secrets and must never be used outside the test suite.
 */
const TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  MONGODB_URI: 'mongodb://127.0.0.1:1/placeholder-replaced-by-useTestDatabase',
  JWT_ACCESS_SECRET: 'test-only-access-secret-not-for-production-0001',
  DATA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  DATA_HASH_KEY: 'test-only-hash-key-not-for-production-000000001',
  SIGNED_URL_SECRET: 'test-only-signed-url-secret-not-for-production-01',
  TELEPHONY_SIMULATOR_SECRET: 'test-only-simulator-secret-not-for-production-01',
  FRONTEND_ORIGINS: 'http://localhost:4200',
  // Cheap password hashing keeps tests fast; production enforces >= 19456 KiB.
  PASSWORD_HASH_MEMORY_KIB: '1024',
  PASSWORD_HASH_TIME_COST: '1',
  RATE_LIMIT_MAX: '10000',
  AUTH_RATE_LIMIT_MAX: '10000',
};

for (const [key, value] of Object.entries(TEST_ENV)) {
  if (process.env[key] === undefined) process.env[key] = value;
}
process.env.NODE_ENV = 'test';
