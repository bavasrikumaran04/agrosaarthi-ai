import { Schema, type SchemaOptions } from 'mongoose';

/**
 * Options shared by every schema: timestamps, no __v in JSON, `id` instead of `_id`.
 * Modules still map documents to explicit DTOs; this transform is defence in depth.
 *
 * Generic + `const` on purpose: Mongoose's InferSchemaType only works when the
 * options keep their literal types (a value typed as plain `SchemaOptions`
 * collapses inference of every field).
 */
export function baseOptions<const E extends SchemaOptions = { timestamps: true }>(collection: string, extra?: E) {
  return {
    collection,
    timestamps: true as const,
    strict: true as const,
    toJSON: {
      versionKey: false,
      transform: (_doc: unknown, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.passwordHash;
        return ret;
      },
    },
    ...(extra as E),
  };
}

/**
 * A phone number stored without clear text: keyed hash for lookup, AES-GCM
 * ciphertext (excluded from queries unless explicitly selected) and last 4 digits.
 */
export const protectedPhoneSchema = new Schema(
  {
    hash: { type: String, required: true },
    encrypted: { type: String, required: true, select: false },
    last4: { type: String, required: true, minlength: 4, maxlength: 4 },
  },
  { _id: false },
);

/** Snapshot of a knowledge source cited in an AI answer (kept even if the document changes later). */
export const sourceRefSchema = new Schema(
  {
    chunkId: { type: Schema.Types.ObjectId, ref: 'KnowledgeChunk' },
    documentId: { type: Schema.Types.ObjectId, ref: 'KnowledgeDocument' },
    docKey: { type: String, maxlength: 200 },
    docVersion: { type: Number },
    title: { type: String, maxlength: 300 },
    sourceOrganization: { type: String, maxlength: 300 },
    sourceUrl: { type: String, maxlength: 2000 },
    trustStatus: { type: String, maxlength: 40 },
    heading: { type: String, maxlength: 300 },
  },
  { _id: false },
);

/** Which AI produced a piece of text — always recorded, including simulators. */
export const aiProvenanceSchema = new Schema(
  {
    provider: { type: String, required: true, maxlength: 60 },
    model: { type: String, maxlength: 120 },
    simulated: { type: Boolean, required: true, default: false },
    promptTokens: { type: Number },
    outputTokens: { type: Number },
    latencyMs: { type: Number },
  },
  { _id: false },
);
