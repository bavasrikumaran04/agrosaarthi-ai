import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { baseOptions } from '../schema-helpers.js';

/**
 * Idempotency record for provider webhooks. A retried delivery with the same
 * idempotency key gets the originally generated response replayed instead of
 * being processed twice.
 */
const webhookEventSchema = new Schema(
  {
    provider: { type: String, required: true, maxlength: 40 },
    idempotencyKey: { type: String, required: true, maxlength: 300 },
    callSessionId: { type: Schema.Types.ObjectId, ref: 'CallSession' },
    status: { type: String, enum: ['PROCESSING', 'DONE'], default: 'PROCESSING' },
    responseStatus: { type: Number },
    responseContentType: { type: String, maxlength: 100 },
    responseBody: { type: String, maxlength: 64_000 },
    expiresAt: { type: Date, required: true },
  },
  baseOptions('webhook_events'),
);

webhookEventSchema.index({ provider: 1, idempotencyKey: 1 }, { unique: true });
webhookEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type WebhookEvent = InferSchemaType<typeof webhookEventSchema>;
export type WebhookEventDocument = HydratedDocument<WebhookEvent>;
export const WebhookEventModel = model('WebhookEvent', webhookEventSchema);
