import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { TRUST_STATUSES } from '../../shared/constants.js';
import { baseOptions } from '../schema-helpers.js';

/**
 * Retrieval unit derived from a KnowledgeDocument (one heading section, split
 * further when long). Metadata is denormalised from the parent document so
 * metadata filters run in a single indexed query. Regenerated on every
 * document version change.
 */
const knowledgeChunkSchema = new Schema(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'KnowledgeDocument', required: true },
    docKey: { type: String, required: true, maxlength: 200 },
    docVersion: { type: Number, required: true },
    chunkIndex: { type: Number, required: true, min: 0 },
    heading: { type: String, maxlength: 300, default: '' },
    text: { type: String, required: true, maxlength: 8000 },
    /** Normalised search terms (lower-cased, stop-words removed) used by the BM25 retriever. */
    terms: { type: [String], default: [] },
    termCount: { type: Number, default: 0 },
    crops: { type: [String], default: [] },
    diseases: { type: [String], default: [] },
    topics: { type: [String], default: [] },
    language: { type: String, required: true, maxlength: 8 },
    trustStatus: { type: String, enum: [...TRUST_STATUSES], required: true },
    /** True when the passage contains a pesticide quantity/rate (drives the dosage safety policy). */
    containsDosage: { type: Boolean, default: false },
    source: {
      title: { type: String, maxlength: 300 },
      sourceOrganization: { type: String, maxlength: 300 },
      sourceUrl: { type: String, maxlength: 2000 },
    },
  },
  baseOptions('knowledge_chunks'),
);

knowledgeChunkSchema.index({ documentId: 1, chunkIndex: 1 }, { unique: true });
knowledgeChunkSchema.index({ trustStatus: 1, crops: 1 });
knowledgeChunkSchema.index({ diseases: 1 });
knowledgeChunkSchema.index({ terms: 1 });

export type KnowledgeChunk = InferSchemaType<typeof knowledgeChunkSchema>;
export type KnowledgeChunkDocument = HydratedDocument<KnowledgeChunk>;
export const KnowledgeChunkModel = model('KnowledgeChunk', knowledgeChunkSchema);
