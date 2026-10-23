import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { baseOptions } from '../schema-helpers.js';
import { REFERENCE_MANAGERS } from './crop.model.js';

export const DISEASE_TYPES = ['FUNGAL', 'BACTERIAL', 'VIRAL', 'PEST', 'NUTRIENT', 'PHYSIOLOGICAL', 'HEALTHY', 'OTHER'] as const;
export type DiseaseType = (typeof DISEASE_TYPES)[number];

/**
 * Disease / pest / condition reference data, keyed e.g. "tomato_early_blight".
 * `modelClassKeys` maps image-model output labels onto this record, keeping the
 * model's label vocabulary decoupled from the domain vocabulary.
 */
const diseaseSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z][a-z0-9_]{1,99}$/ },
    /** Must reference an existing crop (checked by the diseases service and the seed). Immutable after creation. */
    cropKey: { type: String, required: true, lowercase: true, maxlength: 60 },
    type: { type: String, enum: [...DISEASE_TYPES], required: true },
    names: { type: Map, of: String, required: true },
    synonyms: { type: Map, of: [String], default: {} },
    causalAgent: { type: String, trim: true, maxlength: 300 },
    summary: { type: Map, of: String, default: {} },
    /** Exact image-model labels (e.g. PlantVillage folder names) that map to this record. */
    modelClassKeys: { type: [String], default: [] },
    active: { type: Boolean, default: true },
    managedBy: { type: String, enum: [...REFERENCE_MANAGERS], default: 'ADMIN' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isDemo: { type: Boolean, default: false },
  },
  baseOptions('diseases'),
);

/**
 * A model class maps to at most one disease record. A unique multikey index enforces
 * this across documents; the partial filter skips documents whose array is empty
 * (otherwise every record without class keys would collide on the "missing" key).
 */
diseaseSchema.index(
  { modelClassKeys: 1 },
  { unique: true, name: 'modelClassKeys_unique', partialFilterExpression: { modelClassKeys: { $type: 'string' } } },
);
diseaseSchema.index({ cropKey: 1, active: 1 });

export type Disease = InferSchemaType<typeof diseaseSchema>;
export type DiseaseDocument = HydratedDocument<Disease>;
export const DiseaseModel = model('Disease', diseaseSchema);
