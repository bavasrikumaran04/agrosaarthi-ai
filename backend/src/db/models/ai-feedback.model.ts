import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { AI_FLAG_CATEGORIES } from '../../shared/constants.js';
import { baseOptions } from '../schema-helpers.js';

export const AI_FEEDBACK_TARGETS = ['IMAGE_ANALYSIS', 'CONVERSATION_MESSAGE', 'CASE_SUMMARY', 'CASE_GUIDANCE'] as const;

/** Experts flag incorrect or unsafe AI output; administrators review the flags. */
const aiFeedbackSchema = new Schema(
  {
    targetType: { type: String, enum: [...AI_FEEDBACK_TARGETS], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    caseId: { type: Schema.Types.ObjectId, ref: 'SupportCase', index: true },
    flaggedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, enum: [...AI_FLAG_CATEGORIES], required: true },
    comment: { type: String, trim: true, maxlength: 2000, default: '' },
    status: { type: String, enum: ['OPEN', 'REVIEWED', 'DISMISSED'], default: 'OPEN' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewNote: { type: String, maxlength: 2000 },
  },
  baseOptions('ai_feedback'),
);

aiFeedbackSchema.index({ status: 1, createdAt: -1 });
aiFeedbackSchema.index({ targetType: 1, targetId: 1 });

export type AiFeedback = InferSchemaType<typeof aiFeedbackSchema>;
export type AiFeedbackDocument = HydratedDocument<AiFeedback>;
export const AiFeedbackModel = model('AiFeedback', aiFeedbackSchema);
