import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { baseOptions } from '../schema-helpers.js';

/**
 * Opaque refresh tokens (stored as SHA-256 hashes only). Rotated on every use;
 * re-use of a rotated token revokes the whole family (token theft detection).
 */
const refreshTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    familyId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    revokedReason: { type: String, maxlength: 60 },
    replacedByHash: { type: String },
  },
  baseOptions('refresh_tokens'),
);

// MongoDB removes expired tokens automatically.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshToken = InferSchemaType<typeof refreshTokenSchema>;
export type RefreshTokenDocument = HydratedDocument<RefreshToken>;
export const RefreshTokenModel = model('RefreshToken', refreshTokenSchema);
