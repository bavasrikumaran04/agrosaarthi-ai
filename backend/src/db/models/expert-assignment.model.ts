import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { baseOptions } from '../schema-helpers.js';

/** History of which expert was responsible for a case and who assigned them. */
const expertAssignmentSchema = new Schema(
  {
    caseId: { type: Schema.Types.ObjectId, ref: 'SupportCase', required: true },
    expertId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    selfAssigned: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    endedAt: { type: Date },
    endReason: { type: String, maxlength: 200 },
  },
  baseOptions('expert_assignments'),
);

expertAssignmentSchema.index({ expertId: 1, active: 1, createdAt: -1 });
expertAssignmentSchema.index({ caseId: 1, createdAt: -1 });
// At most one active assignment per case.
expertAssignmentSchema.index(
  { caseId: 1 },
  { unique: true, partialFilterExpression: { active: true }, name: 'one_active_assignment_per_case' },
);

export type ExpertAssignment = InferSchemaType<typeof expertAssignmentSchema>;
export type ExpertAssignmentDocument = HydratedDocument<ExpertAssignment>;
export const ExpertAssignmentModel = model('ExpertAssignment', expertAssignmentSchema);
