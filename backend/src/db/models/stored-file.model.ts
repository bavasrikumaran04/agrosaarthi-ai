import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { FILE_PURPOSES } from '../../shared/constants.js';
import { baseOptions } from '../schema-helpers.js';

/**
 * Metadata for blobs kept in object storage (images, audio). Blobs never live
 * in MongoDB. The retention job deletes the object first, then sets deletedAt,
 * so there is no TTL index here (a TTL would orphan the stored object).
 */
const storedFileSchema = new Schema(
  {
    storageProvider: { type: String, enum: ['local', 's3'], required: true },
    storageKey: { type: String, required: true, unique: true, maxlength: 500 },
    purpose: { type: String, enum: [...FILE_PURPOSES], required: true },
    mimeType: { type: String, required: true, maxlength: 100 },
    sizeBytes: { type: Number, required: true, min: 0 },
    sha256: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    caseId: { type: Schema.Types.ObjectId, ref: 'SupportCase', index: true },
    callSessionId: { type: Schema.Types.ObjectId, ref: 'CallSession' },
    expiresAt: { type: Date },
    deletedAt: { type: Date },
  },
  baseOptions('stored_files'),
);

storedFileSchema.index({ expiresAt: 1, deletedAt: 1 });

export type StoredFile = InferSchemaType<typeof storedFileSchema>;
export type StoredFileDocument = HydratedDocument<StoredFile>;
export const StoredFileModel = model('StoredFile', storedFileSchema);
