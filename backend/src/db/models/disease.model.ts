import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { baseOptions } from '../schema-helpers.js';

export const DISEASE_TYPES = ['FUNGAL', 'BACTERIAL', 'VIRAL', 'PEST', 'NUTRIENT', 'PHYSIOLOGICAL', 'HEALTHY', 'OTHER'] as const;

/**
 * Disease / pest / condition reference data, keyed e.g. "tomato_early_blight".
 * `modelClassKeys` maps image-model output labels onto this record, keeping the
 * model's label vocabulary decoupled from the domain vocabulary.
 */
const diseaseSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z][a-z0-9_]{1,99}$/ },
    cropKey: { type: String, required: true, lowercase: true, index: true },
    type: { type: String, enum: [...DISEASE_TYPES], required: true },
    names: { type: Map, of: String, required: true },
    synonyms: { type: Map, of: [String], default: {} },
    causalAgent: { type: String, trim: true, maxlength: 300 },
    summary: { type: Map, of: String, default: {} },
    modelClassKeys: { type: [String], default: [] },
    active: { type: Boolean, default: true },
    isDemo: { type: Boolean, default: false },
  },
  baseOptions('diseases'),
);

diseaseSchema.index({ modelClassKeys: 1 });
diseaseSchema.index({ cropKey: 1, active: 1 });

export type Disease = InferSchemaType<typeof diseaseSchema>;
export type DiseaseDocument = HydratedDocument<Disease>;
export const DiseaseModel = model('Disease', diseaseSchema);
