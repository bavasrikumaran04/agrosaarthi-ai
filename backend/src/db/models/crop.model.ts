import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { baseOptions } from '../schema-helpers.js';

/**
 * Who maintains a reference record (crops, diseases):
 *  - SEED:  created by `npm run db:seed`; re-running the seed refreshes its content.
 *  - ADMIN: created or edited by an administrator; the seed never overwrites it
 *           (so a native-speaker correction of a Tamil name is not reverted).
 */
export const REFERENCE_MANAGERS = ['SEED', 'ADMIN'] as const;
export type ReferenceManager = (typeof REFERENCE_MANAGERS)[number];

/**
 * Crop reference data. Names and synonyms are stored per language code so the
 * retrieval layer can map a Tamil word (e.g. "தக்காளி") to the crop key "tomato".
 */
const cropSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z][a-z0-9_]{1,59}$/ },
    names: { type: Map, of: String, required: true },
    synonyms: { type: Map, of: [String], default: {} },
    scientificName: { type: String, trim: true, maxlength: 200 },
    /** True when the image model has classes for this crop. */
    supportedByModel: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    notes: { type: String, maxlength: 2000 },
    managedBy: { type: String, enum: [...REFERENCE_MANAGERS], default: 'ADMIN' },
    /** Last administrator who changed the record (absent for seed-managed records). */
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isDemo: { type: Boolean, default: false },
  },
  baseOptions('crops'),
);

cropSchema.index({ active: 1, key: 1 });

export type Crop = InferSchemaType<typeof cropSchema>;
export type CropDocument = HydratedDocument<Crop>;
export const CropModel = model('Crop', cropSchema);
