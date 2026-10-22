import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { baseOptions, protectedPhoneSchema } from '../schema-helpers.js';

/**
 * Farmers known only through the telephone channel (no web account required).
 * Keyed by the caller's phone-number hash. Phone history is deliberately NOT
 * auto-linked to a web account with the same number: without verifying phone
 * ownership (OTP), that would let anyone read another farmer's call history.
 */
const consentRecordSchema = new Schema(
  {
    given: { type: Boolean, required: true },
    at: { type: Date, required: true },
    channel: { type: String, enum: ['PHONE', 'WEB'], required: true },
    noticeVersion: { type: String, required: true, maxlength: 40 },
  },
  { _id: false },
);

const farmerProfileSchema = new Schema(
  {
    phone: { type: protectedPhoneSchema, required: true },
    preferredLanguage: { type: String, maxlength: 8 },
    district: { type: String, trim: true, maxlength: 120 },
    state: { type: String, trim: true, maxlength: 120 },
    aiProcessingConsent: { type: consentRecordSchema, required: false },
    lastContactAt: { type: Date },
    callCount: { type: Number, default: 0 },
    isDemo: { type: Boolean, default: false },
    anonymizedAt: { type: Date },
  },
  baseOptions('farmer_profiles'),
);

farmerProfileSchema.index({ 'phone.hash': 1 }, { unique: true });

export type FarmerProfile = InferSchemaType<typeof farmerProfileSchema>;
export type FarmerProfileDocument = HydratedDocument<FarmerProfile>;
export const FarmerProfileModel = model('FarmerProfile', farmerProfileSchema);
