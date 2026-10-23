/**
 * Errors raised by object-storage adapters. Callers (the files module) map them
 * to AppErrors; messages never contain credentials, bucket URLs or file content.
 */
export class StorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'StorageError';
  }
}

/** The key is malformed or would escape the storage root (path traversal). */
export class InvalidStorageKeyError extends StorageError {
  constructor(message = 'Invalid storage key') {
    super(message);
    this.name = 'InvalidStorageKeyError';
  }
}

export class StorageObjectNotFoundError extends StorageError {
  constructor(message = 'Stored object not found', options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StorageObjectNotFoundError';
  }
}

/** The backing store failed (disk error, network error, provider 5xx/403, timeout). */
export class StorageUnavailableError extends StorageError {
  constructor(message = 'Object storage is unavailable', options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StorageUnavailableError';
  }
}
