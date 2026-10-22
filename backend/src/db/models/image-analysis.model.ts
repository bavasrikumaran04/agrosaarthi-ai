import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { ANALYSIS_OUTCOMES, ANALYSIS_STATUSES } from '../../shared/constants.js';
import { aiProvenanceSchema, baseOptions, sourceRefSchema } from '../schema-helpers.js';

const predictionSchema = new Schema(
  {
    classKey: { type: String, required: true, maxlength: 120 }, // model label, e.g. "Tomato___Early_blight"
    cropKey: { type: String, maxlength: 60 },
    diseaseKey: { type: String, maxlength: 100 }, // mapped domain key, e.g. "tomato_early_blight"
    label: { type: String, maxlength: 200 },
    /** Model output score (softmax probability) — NOT a verified diagnostic certainty. */
    score: { type: Number, min: 0, max: 1, required: true },
  },
  { _id: false },
);

/**
 * One crop-image analysis. Records exactly which model produced which scores,
 * whether the result was simulated, the quality / out-of-domain checks, and
 * the source-grounded guidance shown to the farmer.
 */
const imageAnalysisSchema = new Schema(
  {
    caseId: { type: Schema.Types.ObjectId, ref: 'SupportCase', required: true, index: true },
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    fileId: { type: Schema.Types.ObjectId, ref: 'StoredFile', required: true },
    image: {
      mimeType: { type: String, required: true },
      sizeBytes: { type: Number, required: true },
      width: { type: Number, required: true },
      height: { type: Number, required: true },
      sha256: { type: String, required: true },
    },
    request: {
      cropKey: { type: String, maxlength: 60 },
      symptomsText: { type: String, maxlength: 2000 },
      language: { type: String, required: true, maxlength: 8 },
    },
    status: { type: String, enum: [...ANALYSIS_STATUSES], default: 'PENDING' },
    outcome: { type: String, enum: [...ANALYSIS_OUTCOMES] },
    model: {
      provider: { type: String, maxlength: 60 },
      name: { type: String, maxlength: 120 },
      version: { type: String, maxlength: 60 },
      simulated: { type: Boolean, default: false },
    },
    predictions: { type: [predictionSchema], default: [] },
    quality: {
      ok: { type: Boolean },
      issues: { type: [String], default: [] },
      metrics: { type: Schema.Types.Mixed },
    },
    outOfDomain: {
      score: { type: Number },
      threshold: { type: Number },
      flagged: { type: Boolean },
      method: { type: String, maxlength: 80 },
    },
    guidance: {
      type: new Schema(
        {
          text: { type: String, maxlength: 6000 },
          language: { type: String, maxlength: 8 },
          sources: { type: [sourceRefSchema], default: [] },
          provenance: { type: aiProvenanceSchema },
          safetyActions: { type: [String], default: [] },
          escalationRecommended: { type: Boolean, default: false },
          generatedAt: { type: Date },
        },
        { _id: false },
      ),
      required: false,
    },
    error: {
      code: { type: String, maxlength: 60 },
      message: { type: String, maxlength: 500 },
    },
    timings: {
      inferenceMs: { type: Number },
      totalMs: { type: Number },
    },
    isDemo: { type: Boolean, default: false },
  },
  baseOptions('image_analyses'),
);

imageAnalysisSchema.index({ ownerUserId: 1, createdAt: -1 });
imageAnalysisSchema.index({ 'model.name': 1, 'model.version': 1, createdAt: -1 });
imageAnalysisSchema.index({ outcome: 1, createdAt: -1 });

export type ImageAnalysis = InferSchemaType<typeof imageAnalysisSchema>;
export type ImageAnalysisDocument = HydratedDocument<ImageAnalysis>;
export const ImageAnalysisModel = model('ImageAnalysis', imageAnalysisSchema);
