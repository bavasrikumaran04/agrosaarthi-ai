import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { baseOptions } from '../schema-helpers.js';

export const ASSESSMENT_CERTAINTIES = ['CONFIRMED', 'PROBABLE', 'UNCERTAIN'] as const;
export const AI_AGREEMENT_LEVELS = ['AGREES', 'PARTIALLY_AGREES', 'DISAGREES', 'NOT_APPLICABLE'] as const;

/** A qualified expert's assessment of a case — the authoritative human opinion. */
const expertAssessmentSchema = new Schema(
  {
    caseId: { type: Schema.Types.ObjectId, ref: 'SupportCase', required: true, index: true },
    expertId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    diagnosis: { type: String, required: true, trim: true, maxlength: 1000 },
    diseaseKey: { type: String, lowercase: true, maxlength: 100 },
    certainty: { type: String, enum: [...ASSESSMENT_CERTAINTIES], required: true },
    recommendations: { type: String, trim: true, maxlength: 4000, default: '' },
    aiAgreement: { type: String, enum: [...AI_AGREEMENT_LEVELS], required: true },
    followUpRequired: { type: Boolean, default: false },
    visibleToFarmer: { type: Boolean, default: true },
    language: { type: String, maxlength: 8 },
  },
  baseOptions('expert_assessments'),
);

expertAssessmentSchema.index({ expertId: 1, createdAt: -1 });

export type ExpertAssessment = InferSchemaType<typeof expertAssessmentSchema>;
export type ExpertAssessmentDocument = HydratedDocument<ExpertAssessment>;
export const ExpertAssessmentModel = model('ExpertAssessment', expertAssessmentSchema);
