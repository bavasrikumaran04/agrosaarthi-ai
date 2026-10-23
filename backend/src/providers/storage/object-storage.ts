import type { Readable } from 'node:stream';

/**
 * Object-storage abstraction. Farmer images and audio never live in MongoDB or
 * in a public bucket: adapters keep objects private and hand out short-lived
 * signed URLs. Keys are validated by every adapter (see storage-key.ts).
 */
export type StorageProviderName = 'local' | 's3';

export interface PutObjectOptions {
  contentType: string;
}

/** Inclusive byte range, as in an HTTP Range header. */
export interface ByteRange {
  start: number;
  end: number;
}

export interface SignedGetUrlOptions {
  ttlSeconds: number;
}

export interface SignedGetUrl {
  url: string;
  expiresAt: Date;
}

/** Public-safe health summary (never contains paths, endpoints or credentials). */
export interface StorageHealth {
  provider: StorageProviderName;
  ok: boolean;
  latencyMs: number;
  detail?: string;
}

export interface ObjectStorage {
  readonly provider: StorageProviderName;
  /** Store (or replace) an object. */
  put(key: string, body: Buffer, options: PutObjectOptions): Promise<void>;
  /** Throws StorageObjectNotFoundError when the object does not exist. */
  get(key: string): Promise<Buffer>;
  /** Readable stream of the object (or a byte range of it); throws StorageObjectNotFoundError before streaming. */
  getStream(key: string, range?: ByteRange): Promise<Readable>;
  /** Idempotent: deleting a missing object succeeds. */
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** Short-lived URL that grants read access to one object without other credentials. */
  signedGetUrl(key: string, options: SignedGetUrlOptions): Promise<SignedGetUrl>;
  /**
   * Only adapters whose signed URLs are served by this API (local storage) implement
   * this: returns the object key for a valid, unexpired token, otherwise null.
   */
  resolveSignedToken?(token: string): string | null;
  healthCheck(): Promise<StorageHealth>;
  /** Remove abandoned temporary files (interrupted writes); returns how many were removed. */
  cleanupTemporaryFiles?(): Promise<number>;
}

/** Signed URLs are short-lived by policy (spec §16), whatever the caller asks for. */
export const MAX_SIGNED_URL_TTL_SECONDS = 3600;
export const MIN_SIGNED_URL_TTL_SECONDS = 1;

export function clampSignedUrlTtl(ttlSeconds: number): number {
  if (!Number.isFinite(ttlSeconds)) return MIN_SIGNED_URL_TTL_SECONDS;
  return Math.min(MAX_SIGNED_URL_TTL_SECONDS, Math.max(MIN_SIGNED_URL_TTL_SECONDS, Math.floor(ttlSeconds)));
}

/**
 * Path (under PUBLIC_BASE_URL) of the API route that serves local-storage signed
 * tokens. The files module mounts its router so that this path matches.
 */
export const SIGNED_FILE_ROUTE_PATH = '/api/v1/files/signed';
