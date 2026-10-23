import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { FILE_PURPOSES } from '../../shared/constants.js';
import { baseOptions } from '../schema-helpers.js';

export const FILE_DELETION_REASONS = ['RETENTION', 'REQUESTED'] as const;
export type FileDeletionReason = (typeof FILE_DELETION_REASONS)[number];

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
    /** End of the retention period; the retention sweep deletes the object after this. */
    expiresAt: { type: Date },
    deletedAt: { type: Date },
    deletionReason: { type: String, enum: [...FILE_DELETION_REASONS] },
    /** Failed retention deletions back off so one broken object cannot stall the sweep. */
    deletionAttempts: { type: Number, default: 0 },
    nextDeletionAttemptAt: { type: Date },
  },
  baseOptions('stored_files'),
);

// Retention sweep: equality on deletedAt (null), then range + sort on expiresAt.
storedFileSchema.index({ deletedAt: 1, expiresAt: 1 });

export type StoredFile = InferSchemaType<typeof storedFileSchema>;
export type StoredFileDocument = HydratedDocument<StoredFile>;
export const StoredFileModel = model('StoredFile', storedFileSchema);
