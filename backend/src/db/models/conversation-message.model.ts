import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { aiProvenanceSchema, baseOptions, sourceRefSchema } from '../schema-helpers.js';

/** One turn in an assistant conversation. Expires with the conversation. */
const conversationMessageSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    role: { type: String, enum: ['FARMER', 'ASSISTANT', 'SYSTEM'], required: true },
    text: { type: String, required: true, maxlength: 8000 },
    language: { type: String, required: true, maxlength: 8 },
    /** What kind of assistant reply this was. */
    kind: {
      type: String,
      enum: ['QUESTION', 'FOLLOW_UP', 'GUIDANCE', 'UNCERTAIN', 'ESCALATION', 'SOURCE_EXCERPTS', 'ERROR', 'NOTICE'],
      default: 'QUESTION',
    },
    input: {
      modality: { type: String, enum: ['TEXT', 'VOICE'], default: 'TEXT' },
      sttProvider: { type: String, maxlength: 60 },
      sttConfidence: { type: Number, min: 0, max: 1 },
      sttSimulated: { type: Boolean },
    },
    provenance: { type: aiProvenanceSchema, required: false },
    sources: { type: [sourceRefSchema], default: [] },
    safety: {
      actions: { type: [String], default: [] },
      escalationSuggested: { type: Boolean, default: false },
      escalationReasons: { type: [String], default: [] },
    },
    expiresAt: { type: Date, required: true },
  },
  baseOptions('conversation_messages', { timestamps: { createdAt: true, updatedAt: false } }),
);

conversationMessageSchema.index({ conversationId: 1, createdAt: 1 });
conversationMessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type ConversationMessage = InferSchemaType<typeof conversationMessageSchema>;
export type ConversationMessageDocument = HydratedDocument<ConversationMessage>;
export const ConversationMessageModel = model('ConversationMessage', conversationMessageSchema);
