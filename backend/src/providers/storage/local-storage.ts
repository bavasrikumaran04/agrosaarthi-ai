import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import type { Readable } from 'node:stream';
import type { Clock } from '../../lib/clock.js';
import { StorageObjectNotFoundError, StorageUnavailableError } from './errors.js';
import {
  clampSignedUrlTtl,
  SIGNED_FILE_ROUTE_PATH,
  type ByteRange,
  type ObjectStorage,
  type SignedGetUrl,
  type StorageHealth,
} from './object-storage.js';
import { createSignedTokenCodec } from './signed-token.js';
import { assertValidStorageKey } from './storage-key.js';

const TMP_DIR = '.tmp';

/**
 * Filesystem storage for development (or a persistent, backed-up disk).
 * Writes go to a temp file then are renamed, so readers never see partial files.
 * Signed URLs are HMAC tokens served by the files route of this API.
 */
export function createLocalObjectStorage(opts: {
  baseDir: string;
  signedUrlSecret: string;
  publicBaseUrl: string;
  clock: Clock;
}): ObjectStorage {
  const root = resolve(opts.baseDir);
  const codec = createSignedTokenCodec(opts.signedUrlSecret);

  const pathFor = (key: string): string => {
    assertValidStorageKey(key);
    const full = resolve(root, ...key.split('/'));
    if (!full.startsWith(root + sep)) throw new StorageObjectNotFoundError();
    return full;
  };

  const wrap = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') throw new StorageObjectNotFoundError(undefined, { cause: err });
      if (err instanceof StorageObjectNotFoundError) throw err;
      throw new StorageUnavailableError(undefined, { cause: err });
    }
  };

  return {
    provider: 'local',
    async put(key, body) {
      const target = pathFor(key);
      await wrap(async () => {
        const tmp = join(root, TMP_DIR, `${randomUUID()}.part`);
        await mkdir(dirname(tmp), { recursive: true });
        await mkdir(dirname(target), { recursive: true });
        await writeFile(tmp, body);
        await rename(tmp, target);
      });
    },
    get: (key) => wrap(() => readFile(pathFor(key))),
    async getStream(key, range?: ByteRange): Promise<Readable> {
      const p = pathFor(key);
      await wrap(() => stat(p));
      return range ? createReadStream(p, { start: range.start, end: range.end }) : createReadStream(p);
    },
    async delete(key) {
      await wrap(async () => {
        await unlink(pathFor(key)).catch((e: NodeJS.ErrnoException) => {
          if (e.code !== 'ENOENT') throw e;
        });
      });
    },
    async exists(key) {
      try {
        await stat(pathFor(key));
        return true;
      } catch {
        return false;
      }
    },
    async signedGetUrl(key, { ttlSeconds }): Promise<SignedGetUrl> {
      assertValidStorageKey(key);
      const expiresAt = new Date(opts.clock.now().getTime() + clampSignedUrlTtl(ttlSeconds) * 1000);
      const token = codec.sign(key, expiresAt);
      return { url: `${opts.publicBaseUrl}${SIGNED_FILE_ROUTE_PATH}/${token}`, expiresAt };
    },
    resolveSignedToken(token) {
      return codec.verify(token, opts.clock.now())?.subject ?? null;
    },
    async healthCheck(): Promise<StorageHealth> {
      const started = Date.now();
      const key = `health/${randomUUID()}.txt`;
      try {
        await this.put(key, Buffer.from('ok'), { contentType: 'text/plain' });
        await this.get(key);
        await this.delete(key);
        return { provider: 'local', ok: true, latencyMs: Date.now() - started };
      } catch {
        return { provider: 'local', ok: false, latencyMs: Date.now() - started, detail: 'local storage read/write failed' };
      }
    },
    async cleanupTemporaryFiles() {
      const dir = join(root, TMP_DIR);
      const names = await readdir(dir).catch(() => [] as string[]);
      await Promise.all(names.map((n) => rm(join(dir, n), { force: true })));
      return names.length;
    },
  };
}
