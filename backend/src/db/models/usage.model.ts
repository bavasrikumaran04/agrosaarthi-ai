import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { baseOptions } from '../schema-helpers.js';

export const USAGE_KINDS = ['AI_TEXT', 'STT', 'TTS', 'IMAGE_INFERENCE', 'EMBEDDING'] as const;

/**
 * Per-call usage log for AI and speech providers (cost tracking and the admin
 * metrics view). Estimated cost is filled only when a verified price is configured.
 */
const usageRecordSchema = new Schema(
  {
    kind: { type: String, enum: [...USAGE_KINDS], required: true },
    provider: { type: String, required: true, maxlength: 60 },
    model: { type: String, maxlength: 120 },
    simulated: { type: Boolean, default: false },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    operation: { type: String, maxlength: 80 },
    inputTokens: { type: Number },
    outputTokens: { type: Number },
    audioSeconds: { type: Number },
    characters: { type: Number },
    estimatedCostUsd: { type: Number },
    latencyMs: { type: Number },
    success: { type: Boolean, required: true },
    errorCode: { type: String, maxlength: 60 },
    expiresAt: { type: Date, required: true },
  },
  baseOptions('usage_records', { timestamps: { createdAt: true, updatedAt: false } }),
);

usageRecordSchema.index({ kind: 1, createdAt: -1 });
usageRecordSchema.index({ userId: 1, createdAt: -1 });
usageRecordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type UsageRecord = InferSchemaType<typeof usageRecordSchema>;
export type UsageRecordDocument = HydratedDocument<UsageRecord>;
export const UsageRecordModel = model('UsageRecord', usageRecordSchema);

/** Atomic counters for daily quotas, e.g. key "ai:user:<id>:2026-10-22". */
const usageCounterSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, maxlength: 200 },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'usage_counters', versionKey: false },
);

usageCounterSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const UsageCounterModel = model('UsageCounter', usageCounterSchema);
