import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import type { RetentionConfig } from '../../config/sections/retention.js';
import { StoredFileModel } from '../../db/models/stored-file.model.js';
import { addDays, addHours, type Clock } from '../../lib/clock.js';
import { sha256Hex } from '../../lib/crypto.js';
import { Errors } from '../../lib/errors.js';
import type { Logger } from '../../lib/logger.js';
import { serializeError } from '../../lib/logger.js';
import { StorageObjectNotFoundError, type ObjectStorage } from '../../providers/storage/index.js';
import type { FilePurpose } from '../../shared/constants.js';
import type { FilePort, StoreFileInput, StoredFileRef } from '../../shared/ports.js';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
};

export interface FilesService extends FilePort {
  /** Delete objects whose retention period has ended. Returns how many were removed. */
  runRetentionSweep(limit?: number): Promise<number>;
  findByStorageKey(key: string): Promise<{ id: string; contentType: string; deleted: boolean } | null>;
}

export function retentionFor(purpose: FilePurpose, r: RetentionConfig, now: Date): Date {
  switch (purpose) {
    case 'CROP_IMAGE':
      return addDays(now, r.cropImageDays);
    case 'VOICE_INPUT':
      return addHours(now, r.voiceInputHours);
    case 'TTS_AUDIO':
      return addHours(now, r.ttsAudioHours);
    case 'CALL_RECORDING':
      return addDays(now, r.callRecordingDays);
  }
}

export function createFilesService(deps: {
  storage: ObjectStorage;
  retention: RetentionConfig;
  signedUrlTtlSeconds: number;
  clock: Clock;
  logger: Logger;
}): FilesService {
  const { storage, clock } = deps;
  const log = deps.logger.child({ module: 'files' });

  const load = async (fileId: string) => {
    if (!Types.ObjectId.isValid(fileId)) throw Errors.notFound('File');
    const doc = await StoredFileModel.findById(fileId).lean();
    if (!doc || doc.deletedAt) throw Errors.notFound('File');
    return doc;
  };

  return {
    async store(input: StoreFileInput): Promise<StoredFileRef> {
      const now = clock.now();
      const ext = EXTENSIONS[input.contentType] ?? 'bin';
      const month = String(now.getUTCMonth() + 1).padStart(2, '0');
      const key = `${input.purpose.toLowerCase()}/${now.getUTCFullYear()}/${month}/${randomUUID()}.${ext}`;
      const sha256 = sha256Hex(input.body);
      await storage.put(key, input.body, { contentType: input.contentType });
      const expiresAt = input.retentionHours
        ? addHours(now, input.retentionHours)
        : retentionFor(input.purpose, deps.retention, now);
      const doc = await StoredFileModel.create({
        storageProvider: storage.provider,
        storageKey: key,
        purpose: input.purpose,
        mimeType: input.contentType,
        sizeBytes: input.body.length,
        sha256,
        ownerUserId: input.ownerUserId,
        caseId: input.caseId,
        callSessionId: input.callSessionId,
        expiresAt,
      });
      return { fileId: doc._id.toHexString(), storageKey: key, sha256, sizeBytes: input.body.length, contentType: input.contentType };
    },

    async read(fileId) {
      const doc = await load(fileId);
      try {
        return { body: await storage.get(doc.storageKey), contentType: doc.mimeType };
      } catch (err) {
        if (err instanceof StorageObjectNotFoundError) throw Errors.notFound('File');
        throw Errors.serviceUnavailable('File storage', { cause: err });
      }
    },

    async signedUrl(fileId, ttlSeconds) {
      const doc = await load(fileId);
      return (await storage.signedGetUrl(doc.storageKey, { ttlSeconds: ttlSeconds ?? deps.signedUrlTtlSeconds })).url;
    },

    async remove(fileId) {
      const doc = await load(fileId);
      await storage.delete(doc.storageKey);
      await StoredFileModel.updateOne({ _id: doc._id }, { $set: { deletedAt: clock.now(), deletionReason: 'REQUESTED' } });
    },

    async findByStorageKey(key) {
      const doc = await StoredFileModel.findOne({ storageKey: key }).lean();
      return doc ? { id: doc._id.toHexString(), contentType: doc.mimeType, deleted: Boolean(doc.deletedAt) } : null;
    },

    async runRetentionSweep(limit = 200) {
      const now = clock.now();
      const due = await StoredFileModel.find({
        deletedAt: null,
        expiresAt: { $lte: now },
        $or: [{ nextDeletionAttemptAt: null }, { nextDeletionAttemptAt: { $lte: now } }],
      })
        .sort({ expiresAt: 1 })
        .limit(limit)
        .lean();
      let removed = 0;
      for (const doc of due) {
        try {
          await storage.delete(doc.storageKey);
          await StoredFileModel.updateOne({ _id: doc._id }, { $set: { deletedAt: now, deletionReason: 'RETENTION' } });
          removed += 1;
        } catch (err) {
          const attempts = (doc.deletionAttempts ?? 0) + 1;
          await StoredFileModel.updateOne(
            { _id: doc._id },
            { $set: { deletionAttempts: attempts, nextDeletionAttemptAt: addHours(now, Math.min(24, 2 ** attempts)) } },
          );
          log.error({ err: serializeError(err), fileId: doc._id.toHexString() }, 'retention deletion failed');
        }
      }
      return removed;
    },
  };
}
