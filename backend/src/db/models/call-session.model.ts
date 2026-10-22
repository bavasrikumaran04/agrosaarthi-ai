import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { CALL_OUTCOMES, CALL_STATES } from '../../shared/constants.js';
import { baseOptions, protectedPhoneSchema } from '../schema-helpers.js';

const callEventSchema = new Schema(
  {
    type: { type: String, required: true, maxlength: 60 },
    at: { type: Date, required: true },
    fromState: { type: String, enum: [...CALL_STATES] },
    toState: { type: String, enum: [...CALL_STATES] },
    detail: { type: String, maxlength: 300 },
  },
  { _id: false },
);

/**
 * State of one telephone call, driven by an explicit finite-state machine.
 * `isSimulated` is true for calls from the development simulator — these are
 * never real telephone calls and are displayed as such.
 */
const callSessionSchema = new Schema(
  {
    provider: { type: String, required: true, maxlength: 40 },
    providerCallId: { type: String, required: true, maxlength: 120 },
    isSimulated: { type: Boolean, required: true },
    caller: { type: protectedPhoneSchema, required: false },
    farmerProfileId: { type: Schema.Types.ObjectId, ref: 'FarmerProfile' },
    state: { type: String, enum: [...CALL_STATES], required: true, default: 'NEW_CALL' },
    language: { type: String, maxlength: 8 },
    consent: {
      given: { type: Boolean },
      at: { type: Date },
      noticeVersion: { type: String, maxlength: 40 },
    },
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation' },
    caseId: { type: Schema.Types.ObjectId, ref: 'SupportCase' },
    callbackRequestId: { type: Schema.Types.ObjectId, ref: 'CallbackRequest' },
    counters: {
      noInput: { type: Number, default: 0 },
      lowConfidence: { type: Number, default: 0 },
      turns: { type: Number, default: 0 },
      errors: { type: Number, default: 0 },
      holdPolls: { type: Number, default: 0 },
    },
    /** Asynchronous response generation (the webhook answers with a hold message while this runs). */
    pending: {
      jobId: { type: String, maxlength: 80 },
      status: { type: String, enum: ['NONE', 'PENDING', 'READY', 'FAILED'], default: 'NONE' },
      text: { type: String, maxlength: 4000 },
      audioFileId: { type: Schema.Types.ObjectId, ref: 'StoredFile' },
      startedAt: { type: Date },
      completedAt: { type: Date },
    },
    lastPrompt: { type: String, maxlength: 2000 },
    events: { type: [callEventSchema], default: [] },
    outcome: { type: String, enum: [...CALL_OUTCOMES] },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date },
    durationSeconds: { type: Number },
    expiresAt: { type: Date, required: true },
  },
  baseOptions('call_sessions'),
);

callSessionSchema.index({ provider: 1, providerCallId: 1 }, { unique: true });
callSessionSchema.index({ state: 1, updatedAt: -1 });
callSessionSchema.index({ startedAt: -1 });
callSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type CallSession = InferSchemaType<typeof callSessionSchema>;
export type CallSessionDocument = HydratedDocument<CallSession>;
export const CallSessionModel = model('CallSession', callSessionSchema);
