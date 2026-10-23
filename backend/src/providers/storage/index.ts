import type { AppConfig } from '../../config/index.js';
import type { Clock } from '../../lib/clock.js';
import { createLocalObjectStorage } from './local-storage.js';
import type { ObjectStorage } from './object-storage.js';
import { createS3ObjectStorage } from './s3-storage.js';

export * from './errors.js';
export * from './object-storage.js';

export function createObjectStorage(config: AppConfig, clock: Clock): ObjectStorage {
  if (config.storage.provider === 's3') return createS3ObjectStorage(config.storage.s3, clock);
  return createLocalObjectStorage({
    baseDir: config.storage.localDir,
    signedUrlSecret: config.storage.signedUrlSecret,
    publicBaseUrl: config.core.publicBaseUrl,
    clock,
  });
}
