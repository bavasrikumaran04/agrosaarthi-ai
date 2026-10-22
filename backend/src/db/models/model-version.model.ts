import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { baseOptions } from '../schema-helpers.js';

/**
 * Image-model versions seen by the platform, recorded from the model service's
 * own model card (GET /v1/model). Metrics are copied verbatim from that card —
 * the backend never invents or edits them.
 */
const modelVersionSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 120 },
    version: { type: String, required: true, maxlength: 60 },
    provider: { type: String, required: true, maxlength: 60 },
    simulated: { type: Boolean, default: false },
    classes: {
      type: [
        new Schema(
          {
            classKey: { type: String, required: true },
            cropKey: { type: String },
            diseaseKey: { type: String },
            label: { type: String },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    modelCard: { type: Schema.Types.Mixed },
    firstSeenAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    active: { type: Boolean, default: false },
    notes: { type: String, maxlength: 2000 },
  },
  baseOptions('model_versions'),
);

modelVersionSchema.index({ name: 1, version: 1 }, { unique: true });

export type ModelVersion = InferSchemaType<typeof modelVersionSchema>;
export type ModelVersionDocument = HydratedDocument<ModelVersion>;
export const ModelVersionModel = model('ModelVersion', modelVersionSchema);
