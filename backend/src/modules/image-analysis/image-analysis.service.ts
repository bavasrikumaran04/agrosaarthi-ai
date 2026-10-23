import { Types } from 'mongoose';
import { ImageAnalysisModel } from '../../db/models/image-analysis.model.js';
import { ModelVersionModel } from '../../db/models/model-version.model.js';
import type { Clock } from '../../lib/clock.js';
import { sha256Hex } from '../../lib/crypto.js';
import { Errors } from '../../lib/errors.js';
import { serializeError, type Logger } from '../../lib/logger.js';
import type { AuthContext } from '../../middleware/auth.js';
import type { CropDiseaseModel, ModelResult } from '../../providers/image-model/image-model.js';
import type { AnalysisOutcome } from '../../shared/constants.js';
import type { CasePort, FilePort, GuidancePort, KnowledgeRetriever, SourceRef } from '../../shared/ports.js';
import { passageToSourceRef } from '../../shared/ports.js';
import type { ReferenceService } from '../reference/reference.service.js';
import { sanitizeImage } from './image-validation.js';

export interface AnalysisDto {
  id: string;
  caseId: string;
  caseNumber?: string;
  status: string;
  outcome?: AnalysisOutcome;
  /** True when the result came from the development simulator (no real model). */
  simulated: boolean;
  model: { name?: string; version?: string };
  predictions: Array<{ classKey: string; cropKey?: string; diseaseKey?: string; label: string; score: number }>;
  qualityIssues: string[];
  outOfDomain: boolean;
  escalationRecommended: boolean;
  guidance?: { text: string; sources: SourceRef[]; simulated: boolean; kind: string };
  imageFileId: string;
  createdAt?: string;
}

/**
 * Combine model signals into one farmer-facing outcome. Order matters: an
 * unreadable or off-domain photo is never reported as a likely disease.
 */
export function decideOutcome(r: ModelResult, declaredCropSupported: boolean | null): AnalysisOutcome {
  if (declaredCropSupported === false) return 'UNSUPPORTED_CROP';
  if (!r.quality.ok) return 'POOR_QUALITY';
  if (r.outOfDomain.flagged) return 'OUT_OF_DOMAIN';
  if (r.uncertainty.abstain) return 'UNCERTAIN';
  return 'LIKELY_MATCH';
}

export interface ImageAnalysisService {
  analyze(a: AuthContext, input: { file: Buffer; cropKey?: string; symptomsText?: string; language: string }): Promise<AnalysisDto>;
  get(a: AuthContext, id: string): Promise<AnalysisDto>;
  imageUrl(a: AuthContext, id: string): Promise<string>;
}

export function createImageAnalysisService(deps: {
  model: CropDiseaseModel | null;
  files: FilePort;
  cases: CasePort;
  reference: ReferenceService;
  retriever?: KnowledgeRetriever;
  guidance?: GuidancePort;
  clock: Clock;
  logger: Logger;
  limits: { maxPixels: number; minDimension: number };
}): ImageAnalysisService {
  const log = deps.logger.child({ module: 'image-analysis' });

  const toDto = (x: Awaited<ReturnType<typeof loadDoc>>, caseNumber?: string): AnalysisDto => ({
    id: x._id.toHexString(),
    caseId: x.caseId.toHexString(),
    caseNumber,
    status: x.status ?? 'PENDING',
    outcome: (x.outcome ?? undefined) as AnalysisOutcome | undefined,
    simulated: Boolean(x.model?.simulated),
    model: { name: x.model?.name ?? undefined, version: x.model?.version ?? undefined },
    predictions: (x.predictions ?? []).map((p) => ({ classKey: p.classKey, cropKey: p.cropKey ?? undefined, diseaseKey: p.diseaseKey ?? undefined, label: p.label ?? p.classKey, score: p.score })),
    qualityIssues: x.quality?.issues ?? [],
    outOfDomain: Boolean(x.outOfDomain?.flagged),
    escalationRecommended: x.outcome !== 'LIKELY_MATCH' || Boolean(x.guidance?.escalationRecommended),
    guidance: x.guidance?.text
      ? { text: x.guidance.text, sources: (x.guidance.sources ?? []) as SourceRef[], simulated: Boolean(x.guidance.provenance?.simulated), kind: x.guidance.safetyActions?.includes('SOURCE_EXCERPTS') ? 'SOURCE_EXCERPTS' : 'GUIDANCE' }
      : undefined,
    imageFileId: x.fileId.toHexString(),
    createdAt: x.createdAt?.toISOString(),
  });

  async function loadDoc(id: string) {
    if (!Types.ObjectId.isValid(id)) throw Errors.notFound('Analysis');
    const x = await ImageAnalysisModel.findById(id).lean();
    if (!x) throw Errors.notFound('Analysis');
    return x;
  }

  const loadForUser = async (a: AuthContext, id: string) => {
    const x = await loadDoc(id);
    const allowed = await deps.cases.canRead(x.caseId.toHexString(), { type: 'USER', userId: a.userId, role: a.role });
    if (!allowed) throw Errors.notFound('Analysis');
    return x;
  };

  const recordModelVersion = async (model: CropDiseaseModel, r: ModelResult) => {
    const now = deps.clock.now();
    const existing = await ModelVersionModel.exists({ name: r.model.name, version: r.model.version });
    if (existing) {
      await ModelVersionModel.updateOne({ _id: existing._id }, { $set: { lastSeenAt: now } });
      return;
    }
    const card = await model.modelCard();
    await ModelVersionModel.updateOne(
      { name: r.model.name, version: r.model.version },
      { $setOnInsert: { provider: r.provider, simulated: r.simulated, modelCard: card, firstSeenAt: now }, $set: { lastSeenAt: now } },
      { upsert: true },
    );
  };

  return {
    async analyze(a, input) {
      if (!deps.model) throw Errors.serviceNotConfigured('Crop image analysis');
      const started = Date.now();
      const image = await sanitizeImage(input.file, deps.limits);
      const sha = sha256Hex(image.body);

      // Duplicate submission (double tap / retry): return the analysis from the last 10 minutes.
      const recent = await ImageAnalysisModel.findOne({ ownerUserId: a.userId, 'image.sha256': sha, status: 'COMPLETED', createdAt: { $gte: new Date(deps.clock.now().getTime() - 600_000) } }).lean();
      if (recent) return toDto(recent);

      let declaredSupported: boolean | null = null;
      if (input.cropKey) {
        const crops = await deps.reference.listCrops('en');
        const crop = crops.find((c) => c.key === input.cropKey);
        if (!crop) throw Errors.validation([{ path: 'body.cropKey', message: 'Unknown crop' }]);
        declaredSupported = crop.supportedByModel;
      }

      const caseRef = await deps.cases.createCase(
        { origin: 'IMAGE_ANALYSIS', channel: 'WEB', language: input.language, farmerUserId: a.role === 'FARMER' ? a.userId : undefined, cropKey: input.cropKey, symptomsText: input.symptomsText },
        { type: 'USER', userId: a.userId, role: a.role },
      );
      const stored = await deps.files.store({ purpose: 'CROP_IMAGE', body: image.body, contentType: image.contentType, ownerUserId: a.userId, caseId: caseRef.id });
      const doc = await ImageAnalysisModel.create({
        caseId: caseRef.id,
        ownerUserId: a.userId,
        fileId: stored.fileId,
        image: { mimeType: image.contentType, sizeBytes: stored.sizeBytes, width: image.width, height: image.height, sha256: sha },
        request: { cropKey: input.cropKey, symptomsText: input.symptomsText, language: input.language },
        status: 'PENDING',
        model: { provider: deps.model.name, simulated: deps.model.simulated },
      });

      let result: ModelResult;
      try {
        result = await deps.model.predict(image.body, image.contentType);
      } catch (err) {
        await ImageAnalysisModel.updateOne({ _id: doc._id }, { $set: { status: 'FAILED', error: { code: 'MODEL_ERROR', message: 'The model could not process the image' } } });
        await deps.cases.escalate(caseRef.id, { reasons: ['ANALYSIS_FAILED'], requestedBy: 'SYSTEM' }, { type: 'SYSTEM' });
        log.error({ err: serializeError(err), analysisId: doc._id.toHexString() }, 'model prediction failed');
        throw err;
      }

      // Map model labels to domain disease records.
      const mapping = await deps.reference.diseasesForClassKeys(result.predictions.map((p) => p.classKey));
      const predictions = result.predictions.map((p) => {
        const m = mapping.get(p.classKey);
        return { classKey: p.classKey, cropKey: m?.cropKey ?? p.cropKey, diseaseKey: m?.diseaseKey ?? p.diseaseKey, label: p.label, score: p.score };
      });
      // A declared crop that the model does support but that disagrees with the top class is uncertain, not a match.
      let outcome = decideOutcome(result, declaredSupported);
      if (outcome === 'LIKELY_MATCH' && input.cropKey && predictions[0]?.cropKey && predictions[0].cropKey !== input.cropKey) outcome = 'UNCERTAIN';

      let guidance:
        | { text: string; sources: SourceRef[]; simulated: boolean; kind: string; escalationRecommended?: boolean; safetyActions?: string[]; provenance?: unknown }
        | undefined;
      if (deps.retriever && (outcome === 'LIKELY_MATCH' || outcome === 'UNCERTAIN')) {
        try {
          const top = predictions.slice(0, 2);
          const passages = await deps.retriever.retrieve({
            text: [input.symptomsText ?? '', ...top.map((p) => p.label)].join(' '),
            language: input.language,
            cropKeys: [input.cropKey ?? top[0]?.cropKey].filter((x): x is string => Boolean(x)),
            diseaseKeys: top.map((p) => p.diseaseKey).filter((x): x is string => Boolean(x)),
            limit: 4,
          });
          if (deps.guidance && passages.length > 0) {
            const g = await deps.guidance.generateGuidance({
              language: input.language,
              channel: 'WEB',
              question: input.symptomsText,
              cropKey: input.cropKey ?? top[0]?.cropKey,
              diseaseCandidates: top.map((p) => ({ diseaseKey: p.diseaseKey, label: p.label, score: p.score })),
              analysisOutcome: outcome,
              passages,
              userId: a.userId,
            });
            guidance = { text: g.text, sources: g.sources, simulated: g.provenance.simulated, kind: g.kind, escalationRecommended: g.escalationRecommended, safetyActions: [...g.safetyActions, ...(g.kind === 'SOURCE_EXCERPTS' ? ['SOURCE_EXCERPTS'] : [])], provenance: g.provenance };
          } else if (passages.length > 0) {
            guidance = { text: '', sources: passages.map(passageToSourceRef), simulated: false, kind: 'SOURCE_EXCERPTS' };
          }
        } catch (err) {
          // Guidance is helpful but optional: the model result is still returned.
          log.warn({ err: serializeError(err) }, 'guidance generation failed');
        }
      }

      const escalationRecommended = outcome !== 'LIKELY_MATCH' || Boolean(guidance?.escalationRecommended);
      const updated = await ImageAnalysisModel.findByIdAndUpdate(
        doc._id,
        {
          $set: {
            status: 'COMPLETED',
            outcome,
            model: { provider: result.provider, name: result.model.name, version: result.model.version, simulated: result.simulated },
            predictions,
            quality: result.quality,
            outOfDomain: result.outOfDomain,
            ...(guidance ? { guidance: { text: guidance.text, language: input.language, sources: guidance.sources, provenance: guidance.provenance, safetyActions: guidance.safetyActions ?? [], escalationRecommended, generatedAt: deps.clock.now() } } : {}),
            timings: { inferenceMs: result.inferenceMs, totalMs: Date.now() - started },
          },
        },
        { new: true },
      ).lean();

      await deps.cases.attachImageAnalysis(
        caseRef.id,
        { analysisId: doc._id.toHexString(), outcome, topClassKey: predictions[0]?.classKey, topLabel: predictions[0]?.label, topScore: predictions[0]?.score, modelName: result.model.name, modelVersion: result.model.version, simulated: result.simulated },
        guidance?.sources ?? [],
      );
      if (escalationRecommended) {
        await deps.cases.escalate(caseRef.id, { reasons: [`ANALYSIS_${outcome}`], requestedBy: 'SYSTEM' }, { type: 'SYSTEM' });
      }
      await recordModelVersion(deps.model, result).catch(() => undefined);
      return toDto(updated!, caseRef.caseNumber);
    },

    async get(a, id) {
      return toDto(await loadForUser(a, id));
    },

    async imageUrl(a, id) {
      const x = await loadForUser(a, id);
      return deps.files.signedUrl(x.fileId.toHexString());
    },
  };
}
