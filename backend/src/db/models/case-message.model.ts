import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { MESSAGE_ROLES } from '../../shared/constants.js';
import { aiProvenanceSchema, baseOptions, sourceRefSchema } from '../schema-helpers.js';

/**
 * Messages on a support case thread: farmer <-> expert, plus system notices.
 * INTERNAL messages are visible to staff only.
 */
const caseMessageSchema = new Schema(
  {
    caseId: { type: Schema.Types.ObjectId, ref: 'SupportCase', required: true },
    authorRole: { type: String, enum: [...MESSAGE_ROLES], required: true },
    authorUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    language: { type: String, maxlength: 8 },
    text: { type: String, required: true, trim: true, minlength: 1, maxlength: 4000 },
    visibility: { type: String, enum: ['FARMER_VISIBLE', 'INTERNAL'], default: 'FARMER_VISIBLE' },
    provenance: { type: aiProvenanceSchema, required: false },
    sources: { type: [sourceRefSchema], default: [] },
  },
  baseOptions('case_messages', { timestamps: { createdAt: true, updatedAt: false } }),
);

caseMessageSchema.index({ caseId: 1, createdAt: 1 });

export type CaseMessage = InferSchemaType<typeof caseMessageSchema>;
export type CaseMessageDocument = HydratedDocument<CaseMessage>;
export const CaseMessageModel = model('CaseMessage', caseMessageSchema);
