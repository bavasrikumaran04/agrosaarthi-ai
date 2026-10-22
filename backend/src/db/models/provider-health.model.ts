import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { PROVIDER_HEALTH_STATUSES, PROVIDER_KINDS } from '../../shared/constants.js';
import { baseOptions } from '../schema-helpers.js';

/** Results of provider health checks (shown on the admin integration-health screen). */
const providerHealthSchema = new Schema(
  {
    kind: { type: String, enum: [...PROVIDER_KINDS], required: true },
    provider: { type: String, required: true, maxlength: 60 },
    status: { type: String, enum: [...PROVIDER_HEALTH_STATUSES], required: true },
    latencyMs: { type: Number },
    /** Sanitised, user-safe message — never raw provider error bodies. */
    message: { type: String, maxlength: 500 },
    checkedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  baseOptions('provider_health_records', { timestamps: false }),
);

providerHealthSchema.index({ kind: 1, provider: 1, checkedAt: -1 });
providerHealthSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type ProviderHealthRecord = InferSchemaType<typeof providerHealthSchema>;
export type ProviderHealthRecordDocument = HydratedDocument<ProviderHealthRecord>;
export const ProviderHealthModel = model('ProviderHealthRecord', providerHealthSchema);
