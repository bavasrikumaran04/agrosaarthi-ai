import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { PRIVACY_REQUEST_STATUSES, PRIVACY_REQUEST_TYPES } from '../../shared/constants.js';
import { baseOptions } from '../schema-helpers.js';

/** Farmer requests to access, correct or delete personal data (handled by administrators). */
const privacyRequestSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: [...PRIVACY_REQUEST_TYPES], required: true },
    details: { type: String, maxlength: 2000, default: '' },
    status: { type: String, enum: [...PRIVACY_REQUEST_STATUSES], default: 'OPEN' },
    handledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    handledAt: { type: Date },
    resolutionNote: { type: String, maxlength: 2000 },
  },
  baseOptions('privacy_requests'),
);

privacyRequestSchema.index({ status: 1, createdAt: -1 });

export type PrivacyRequest = InferSchemaType<typeof privacyRequestSchema>;
export type PrivacyRequestDocument = HydratedDocument<PrivacyRequest>;
export const PrivacyRequestModel = model('PrivacyRequest', privacyRequestSchema);
