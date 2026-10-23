import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { type Readable } from 'node:stream';
import type { StorageConfig } from '../../config/sections/storage.js';
import type { Clock } from '../../lib/clock.js';
import { StorageObjectNotFoundError, StorageUnavailableError } from './errors.js';
import { clampSignedUrlTtl, type ObjectStorage } from './object-storage.js';
import { assertValidStorageKey } from './storage-key.js';

function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === 'NoSuchKey' || e?.name === 'NotFound' || e?.$metadata?.httpStatusCode === 404;
}

/** Private S3-compatible bucket (AWS S3, Cloudflare R2, Backblaze B2, MinIO). Objects are never public. */
export function createS3ObjectStorage(cfg: StorageConfig['s3'], clock: Clock, client?: S3Client): ObjectStorage {
  const bucket = cfg.bucket!;
  const s3 =
    client ??
    new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      forcePathStyle: cfg.forcePathStyle,
      credentials: { accessKeyId: cfg.accessKeyId!, secretAccessKey: cfg.secretAccessKey! },
    });

  const call = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      if (isNotFound(err)) throw new StorageObjectNotFoundError(undefined, { cause: err });
      throw new StorageUnavailableError(undefined, { cause: err });
    }
  };

  const getBody = async (key: string, range?: string) => {
    assertValidStorageKey(key);
    const out = await call(() => s3.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: range })));
    if (!out.Body) throw new StorageObjectNotFoundError();
    return out.Body as Readable;
  };

  return {
    provider: 's3',
    async put(key, body, { contentType }) {
      assertValidStorageKey(key);
      await call(() => s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType })));
    },
    async get(key) {
      const stream = await getBody(key);
      const chunks: Buffer[] = [];
      for await (const c of stream) chunks.push(Buffer.from(c as Uint8Array));
      return Buffer.concat(chunks);
    },
    getStream: (key, range) => getBody(key, range ? `bytes=${range.start}-${range.end}` : undefined),
    async delete(key) {
      assertValidStorageKey(key);
      await call(() => s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })));
    },
    async exists(key) {
      assertValidStorageKey(key);
      try {
        await call(() => s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key })));
        return true;
      } catch (err) {
        if (err instanceof StorageObjectNotFoundError) return false;
        throw err;
      }
    },
    async signedGetUrl(key, { ttlSeconds }) {
      assertValidStorageKey(key);
      const ttl = clampSignedUrlTtl(ttlSeconds);
      const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: ttl });
      return { url, expiresAt: new Date(clock.now().getTime() + ttl * 1000) };
    },
    async healthCheck() {
      const started = Date.now();
      try {
        await s3.send(new HeadBucketCommand({ Bucket: bucket }));
        return { provider: 's3', ok: true, latencyMs: Date.now() - started };
      } catch {
        return { provider: 's3', ok: false, latencyMs: Date.now() - started, detail: 'bucket not reachable' };
      }
    },
  };
}
