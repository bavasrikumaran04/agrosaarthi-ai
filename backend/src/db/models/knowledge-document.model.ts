import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { TRUST_STATUSES } from '../../shared/constants.js';
import { baseOptions } from '../schema-helpers.js';

const versionHistorySchema = new Schema(
  {
    version: { type: Number, required: true },
    contentHash: { type: String, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, required: true },
    note: { type: String, maxlength: 500 },
  },
  { _id: false },
);

/**
 * An agricultural knowledge document with full source attribution. Content
 * imported from an external source starts as UNREVIEWED_SOURCE_SUMMARY; only a
 * named reviewer can mark it EXPERT_REVIEWED. Nothing is ever presented as
 * verified without that review record.
 */
const knowledgeDocumentSchema = new Schema(
  {
    docKey: { type: String, required: true, unique: true, maxlength: 200, match: /^[a-z0-9][a-z0-9-]{1,199}$/ },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    sourceOrganization: { type: String, required: true, trim: true, maxlength: 300 },
    sourceUrl: { type: String, trim: true, maxlength: 2000 },
    sourceReference: { type: String, trim: true, maxlength: 1000 },
    license: { type: String, trim: true, maxlength: 500 },
    crops: { type: [String], default: [] },
    diseases: { type: [String], default: [] },
    topics: { type: [String], default: [] },
    language: { type: String, required: true, maxlength: 8 },
    publicationDate: { type: Date },
    lastReviewedDate: { type: Date },
    retrievedDate: { type: Date },
    version: { type: Number, required: true, default: 1 },
    contentHash: { type: String, required: true },
    body: { type: String, required: true, maxlength: 200_000 },
    trustStatus: { type: String, enum: [...TRUST_STATUSES], required: true },
    limitations: { type: String, trim: true, maxlength: 2000, default: '' },
    review: {
      type: new Schema(
        {
          reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
          reviewedAt: { type: Date, required: true },
          notes: { type: String, maxlength: 2000 },
        },
        { _id: false },
      ),
      required: false,
    },
    history: { type: [versionHistorySchema], default: [] },
    isDemo: { type: Boolean, default: false },
  },
  baseOptions('knowledge_documents'),
);

knowledgeDocumentSchema.index({ trustStatus: 1, updatedAt: -1 });
knowledgeDocumentSchema.index({ crops: 1 });
knowledgeDocumentSchema.index({ diseases: 1 });

export type KnowledgeDocument = InferSchemaType<typeof knowledgeDocumentSchema>;
export type KnowledgeDocumentDocument = HydratedDocument<KnowledgeDocument>;
export const KnowledgeDocumentModel = model('KnowledgeDocument', knowledgeDocumentSchema);
