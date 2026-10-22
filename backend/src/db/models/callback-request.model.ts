import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import {
  CALLBACK_ATTEMPT_OUTCOMES,
  CALLBACK_SOURCES,
  CALLBACK_STATUSES,
  CASE_PRIORITIES,
} from '../../shared/constants.js';
import { baseOptions, protectedPhoneSchema } from '../schema-helpers.js';

export const CALLBACK_TIME_WINDOWS = ['MORNING', 'AFTERNOON', 'EVENING', 'ANY'] as const;

const attemptSchema = new Schema(
  {
    at: { type: Date, required: true },
    byUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    outcome: { type: String, enum: [...CALLBACK_ATTEMPT_OUTCOMES], required: true },
    notes: { type: String, maxlength: 1000 },
  },
  { _id: false },
);

/**
 * A request for an agricultural expert to call the farmer back. The farmer is
 * told a callback will be attempted — never promised a specific time.
 */
const callbackRequestSchema = new Schema(
  {
    caseId: { type: Schema.Types.ObjectId, ref: 'SupportCase', required: true },
    farmerUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    farmerProfileId: { type: Schema.Types.ObjectId, ref: 'FarmerProfile' },
    phone: { type: protectedPhoneSchema, required: true },
    language: { type: String, required: true, maxlength: 8 },
    preferredTimeWindow: { type: String, enum: [...CALLBACK_TIME_WINDOWS], default: 'ANY' },
    preferredDate: { type: Date },
    reason: { type: String, trim: true, maxlength: 500, default: '' },
    priority: { type: String, enum: [...CASE_PRIORITIES], default: 'NORMAL' },
    status: { type: String, enum: [...CALLBACK_STATUSES], default: 'PENDING' },
    source: { type: String, enum: [...CALLBACK_SOURCES], required: true },
    assignedExpertId: { type: Schema.Types.ObjectId, ref: 'User' },
    scheduledFor: { type: Date },
    attempts: { type: [attemptSchema], default: [] },
    completedAt: { type: Date },
    cancelledReason: { type: String, maxlength: 500 },
    isDemo: { type: Boolean, default: false },
  },
  baseOptions('callback_requests'),
);

callbackRequestSchema.index({ status: 1, priority: 1, createdAt: 1 });
callbackRequestSchema.index({ caseId: 1, createdAt: -1 });
callbackRequestSchema.index({ assignedExpertId: 1, status: 1 });
// Duplicate-submission guard: one open callback per case.
callbackRequestSchema.index(
  { caseId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['PENDING', 'SCHEDULED', 'IN_PROGRESS'] } }, name: 'one_open_callback_per_case' },
);

export type CallbackRequest = InferSchemaType<typeof callbackRequestSchema>;
export type CallbackRequestDocument = HydratedDocument<CallbackRequest>;
export const CallbackRequestModel = model('CallbackRequest', callbackRequestSchema);
