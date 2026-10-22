import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { CASE_ORIGINS, CASE_PRIORITIES, CASE_STATUSES, CHANNELS, ROLES } from '../../shared/constants.js';
import { aiProvenanceSchema, baseOptions, sourceRefSchema } from '../schema-helpers.js';

const statusChangeSchema = new Schema(
  {
    from: { type: String, enum: [...CASE_STATUSES] },
    to: { type: String, enum: [...CASE_STATUSES], required: true },
    byUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    byRole: { type: String, enum: [...ROLES, 'SYSTEM'] },
    at: { type: Date, required: true },
    note: { type: String, maxlength: 1000 },
  },
  { _id: false },
);

const escalationSchema = new Schema(
  {
    required: { type: Boolean, default: false },
    reasons: { type: [String], default: [] },
    requestedBy: { type: String, enum: ['FARMER', 'SYSTEM', 'EXPERT', 'ADMIN'] },
    requestedAt: { type: Date },
  },
  { _id: false },
);

/**
 * A farmer support case: created by an image analysis, an escalated assistant
 * conversation, a phone call or a callback request. The AI summary is stored
 * separately from expert assessments and is never treated as a diagnosis.
 */
const supportCaseSchema = new Schema(
  {
    caseNumber: { type: String, required: true, unique: true, maxlength: 30 },
    origin: { type: String, enum: [...CASE_ORIGINS], required: true },
    channel: { type: String, enum: [...CHANNELS], required: true },
    farmerUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    farmerProfileId: { type: Schema.Types.ObjectId, ref: 'FarmerProfile' },
    language: { type: String, required: true, maxlength: 8 },
    cropKey: { type: String, lowercase: true, maxlength: 60 },
    cropFreeText: { type: String, trim: true, maxlength: 120 },
    symptomsText: { type: String, trim: true, maxlength: 2000 },
    district: { type: String, trim: true, maxlength: 120 },
    state: { type: String, trim: true, maxlength: 120 },
    status: { type: String, enum: [...CASE_STATUSES], default: 'NEW' },
    priority: { type: String, enum: [...CASE_PRIORITIES], default: 'NORMAL' },
    escalation: { type: escalationSchema, default: () => ({}) },
    assignedExpertId: { type: Schema.Types.ObjectId, ref: 'User' },
    imageAnalysisIds: { type: [Schema.Types.ObjectId], ref: 'ImageAnalysis', default: [] },
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation' },
    callSessionId: { type: Schema.Types.ObjectId, ref: 'CallSession' },
    latestAnalysis: {
      type: new Schema(
        {
          analysisId: { type: Schema.Types.ObjectId, ref: 'ImageAnalysis' },
          outcome: { type: String },
          topClassKey: { type: String },
          topLabel: { type: String },
          topScore: { type: Number },
          modelName: { type: String },
          modelVersion: { type: String },
          simulated: { type: Boolean },
        },
        { _id: false },
      ),
      required: false,
    },
    /** AI-generated summary for experts — labelled as AI output, never authoritative. */
    aiSummary: {
      type: new Schema(
        {
          text: { type: String, maxlength: 4000 },
          language: { type: String, maxlength: 8 },
          generatedAt: { type: Date },
          provenance: { type: aiProvenanceSchema },
        },
        { _id: false },
      ),
      required: false,
    },
    sources: { type: [sourceRefSchema], default: [] },
    resolution: {
      type: new Schema(
        {
          summary: { type: String, maxlength: 4000 },
          resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
          resolvedAt: { type: Date },
        },
        { _id: false },
      ),
      required: false,
    },
    statusHistory: { type: [statusChangeSchema], default: [] },
    aiFlagged: { type: Boolean, default: false },
    lastActivityAt: { type: Date, default: () => new Date() },
    isDemo: { type: Boolean, default: false },
  },
  baseOptions('support_cases'),
);

supportCaseSchema.index({ status: 1, priority: 1, createdAt: -1 });
supportCaseSchema.index({ assignedExpertId: 1, status: 1, lastActivityAt: -1 });
supportCaseSchema.index({ farmerUserId: 1, createdAt: -1 });
supportCaseSchema.index({ farmerProfileId: 1, createdAt: -1 });
supportCaseSchema.index({ cropKey: 1, status: 1 });
supportCaseSchema.index({ lastActivityAt: -1 });

export type SupportCase = InferSchemaType<typeof supportCaseSchema>;
export type SupportCaseDocument = HydratedDocument<SupportCase>;
export const SupportCaseModel = model('SupportCase', supportCaseSchema);
