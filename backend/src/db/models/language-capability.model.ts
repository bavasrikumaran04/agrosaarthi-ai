import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { baseOptions } from '../schema-helpers.js';

export const CAPABILITY_STATUSES = ['SUPPORTED', 'UNSUPPORTED', 'UNVERIFIED'] as const;

/**
 * One capability claim, e.g. "provider X supports ta-IN speech recognition".
 * `sourceUrl` + `verifiedAt` record where and when the claim was verified;
 * claims without verification stay UNVERIFIED and are not used.
 */
const capabilityEntrySchema = new Schema(
  {
    provider: { type: String, required: true, maxlength: 60 },
    locale: { type: String, required: true, maxlength: 20 },
    status: { type: String, enum: [...CAPABILITY_STATUSES], required: true },
    voice: { type: String, maxlength: 120 },
    verifiedAt: { type: Date },
    sourceUrl: { type: String, maxlength: 2000 },
    notes: { type: String, maxlength: 1000 },
  },
  { _id: false },
);

/** The language capability registry (see docs/VOICE_PIPELINE.md). */
const languageCapabilitySchema = new Schema(
  {
    code: { type: String, required: true, unique: true, lowercase: true, maxlength: 8 },
    name: { type: String, required: true, maxlength: 60 },
    nativeName: { type: String, required: true, maxlength: 60 },
    /** Administrators can enable/disable a language; disabled languages are rejected by the API. */
    enabled: { type: Boolean, default: false },
    /** UI translation dictionary exists in the frontend. */
    uiTranslation: { type: Boolean, default: false },
    isDefault: { type: Boolean, default: false },
    stt: { type: [capabilityEntrySchema], default: [] },
    tts: { type: [capabilityEntrySchema], default: [] },
    ai: { type: [capabilityEntrySchema], default: [] },
    telephony: { type: [capabilityEntrySchema], default: [] },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  baseOptions('language_capabilities'),
);

export type LanguageCapability = InferSchemaType<typeof languageCapabilitySchema>;
export type LanguageCapabilityDocument = HydratedDocument<LanguageCapability>;
export const LanguageCapabilityModel = model('LanguageCapability', languageCapabilitySchema);
