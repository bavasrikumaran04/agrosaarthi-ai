import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { CHANNELS } from '../../shared/constants.js';
import { baseOptions } from '../schema-helpers.js';

/**
 * An assistant support session (web text, web voice or a phone call). Holds
 * the structured context extracted so far so follow-up questions do not repeat
 * themselves. Expires automatically after the configured retention period.
 */
const conversationSchema = new Schema(
  {
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    farmerProfileId: { type: Schema.Types.ObjectId, ref: 'FarmerProfile' },
    channel: { type: String, enum: [...CHANNELS], required: true },
    language: { type: String, required: true, maxlength: 8 },
    status: { type: String, enum: ['ACTIVE', 'ENDED', 'ESCALATED'], default: 'ACTIVE' },
    context: {
      cropKey: { type: String, maxlength: 60 },
      cropText: { type: String, maxlength: 120 },
      diseaseKeys: { type: [String], default: [] },
      symptoms: { type: [String], default: [] },
      location: { type: String, maxlength: 200 },
      duration: { type: String, maxlength: 200 },
      severity: { type: String, enum: ['LOW', 'MODERATE', 'HIGH', 'SEVERE', 'UNKNOWN'], default: 'UNKNOWN' },
      affectedArea: { type: String, maxlength: 200 },
      imageAnalysisId: { type: Schema.Types.ObjectId, ref: 'ImageAnalysis' },
      missingInformation: { type: [String], default: [] },
      followUpsAsked: { type: Number, default: 0 },
    },
    /** Rolling summary of older turns (AI-generated, bounded) used instead of the full history. */
    summary: { type: String, maxlength: 4000 },
    turnCount: { type: Number, default: 0 },
    caseId: { type: Schema.Types.ObjectId, ref: 'SupportCase' },
    callSessionId: { type: Schema.Types.ObjectId, ref: 'CallSession' },
    lastMessageAt: { type: Date, default: () => new Date() },
    expiresAt: { type: Date, required: true },
    isDemo: { type: Boolean, default: false },
  },
  baseOptions('conversations'),
);

conversationSchema.index({ ownerUserId: 1, lastMessageAt: -1 });
conversationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type Conversation = InferSchemaType<typeof conversationSchema>;
export type ConversationDocument = HydratedDocument<Conversation>;
export const ConversationModel = model('Conversation', conversationSchema);
