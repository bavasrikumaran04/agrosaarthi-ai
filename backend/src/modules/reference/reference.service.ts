import { CropModel } from '../../db/models/crop.model.js';
import { DiseaseModel } from '../../db/models/disease.model.js';
import { Errors } from '../../lib/errors.js';
import { CROPS, DISEASES, SEED_NOTES } from '../../scripts/seed-data/reference.js';

export interface CropDto {
  key: string;
  name: string;
  names: Record<string, string>;
  synonyms: Record<string, string[]>;
  scientificName?: string;
  supportedByModel: boolean;
  diseaseCount?: number;
}

export interface DiseaseDto {
  key: string;
  cropKey: string;
  type: string;
  name: string;
  names: Record<string, string>;
  causalAgent?: string;
  modelClassKeys: string[];
}

type MapLike<T> = Map<string, T> | Record<string, T> | null | undefined;
function toRecord<T>(m: MapLike<T>): Record<string, T> {
  if (!m) return {};
  return m instanceof Map ? Object.fromEntries(m) : { ...m };
}

export function localizedName(names: Record<string, string>, language: string): string {
  return names[language] ?? names.en ?? Object.values(names)[0] ?? '';
}

export interface ReferenceService {
  /** Insert or refresh SEED-managed records; never touches records an administrator edited. */
  ensureSeeded(): Promise<{ crops: number; diseases: number }>;
  listCrops(language: string, includeInactive?: boolean): Promise<CropDto[]>;
  getCrop(key: string, language: string): Promise<CropDto & { diseases: DiseaseDto[] }>;
  listDiseases(language: string, cropKey?: string): Promise<DiseaseDto[]>;
  getDisease(key: string, language: string): Promise<DiseaseDto>;
  /** Map image-model class labels to domain records. */
  diseasesForClassKeys(classKeys: string[]): Promise<Map<string, { diseaseKey: string; cropKey: string; type: string }>>;
  cropExists(key: string): Promise<boolean>;
  updateCrop(key: string, patch: { names?: Record<string, string>; active?: boolean; notes?: string }, userId: string): Promise<CropDto>;
}

export function createReferenceService(): ReferenceService {
  const cropDto = (c: Parameters<typeof toCrop>[0], language: string) => toCrop(c, language);
  function toCrop(
    c: { key: string; names?: MapLike<string>; synonyms?: MapLike<string[]>; scientificName?: string | null; supportedByModel?: boolean | null },
    language: string,
  ): CropDto {
    const names = toRecord(c.names);
    return {
      key: c.key,
      name: localizedName(names, language),
      names,
      synonyms: toRecord(c.synonyms),
      scientificName: c.scientificName ?? undefined,
      supportedByModel: c.supportedByModel ?? false,
    };
  }
  function toDisease(
    x: { key: string; cropKey: string; type: string; names?: MapLike<string>; causalAgent?: string | null; modelClassKeys?: string[] | null },
    language: string,
  ): DiseaseDto {
    const names = toRecord(x.names);
    return {
      key: x.key,
      cropKey: x.cropKey,
      type: x.type,
      name: localizedName(names, language),
      names,
      causalAgent: x.causalAgent ?? undefined,
      modelClassKeys: x.modelClassKeys ?? [],
    };
  }

  return {
    async ensureSeeded() {
      let crops = 0;
      let diseases = 0;
      for (const c of CROPS) {
        const res = await CropModel.updateOne(
          { key: c.key, managedBy: { $ne: 'ADMIN' } },
          {
            $set: {
              names: { en: c.en, ta: c.ta },
              synonyms: c.synonyms ?? {},
              scientificName: c.scientificName,
              supportedByModel: c.supportedByModel,
              notes: SEED_NOTES,
              managedBy: 'SEED',
            },
            $setOnInsert: { key: c.key, active: true },
          },
          { upsert: true },
        ).catch((err: { code?: number }) => {
          if (err.code === 11000) return { upsertedCount: 0 }; // exists and is admin-managed
          throw err;
        });
        crops += res.upsertedCount ?? 0;
      }
      for (const x of DISEASES) {
        const res = await DiseaseModel.updateOne(
          { key: x.key, managedBy: { $ne: 'ADMIN' } },
          {
            $set: {
              cropKey: x.cropKey,
              type: x.type,
              names: { en: x.en, ta: x.ta },
              causalAgent: x.causalAgent,
              modelClassKeys: x.modelClassKeys,
              managedBy: 'SEED',
            },
            $setOnInsert: { key: x.key, active: true },
          },
          { upsert: true },
        ).catch((err: { code?: number }) => {
          if (err.code === 11000) return { upsertedCount: 0 };
          throw err;
        });
        diseases += res.upsertedCount ?? 0;
      }
      return { crops, diseases };
    },

    async listCrops(language, includeInactive = false) {
      const rows = await CropModel.find(includeInactive ? {} : { active: true }).sort({ supportedByModel: -1, key: 1 }).lean();
      const counts = await DiseaseModel.aggregate<{ _id: string; n: number }>([
        { $match: { active: true, type: { $ne: 'HEALTHY' } } },
        { $group: { _id: '$cropKey', n: { $sum: 1 } } },
      ]);
      const byCrop = new Map(counts.map((c) => [c._id, c.n]));
      return rows.map((r) => ({ ...cropDto(r, language), diseaseCount: byCrop.get(r.key) ?? 0 }));
    },

    async getCrop(key, language) {
      const crop = await CropModel.findOne({ key, active: true }).lean();
      if (!crop) throw Errors.notFound('Crop');
      const diseases = await DiseaseModel.find({ cropKey: key, active: true }).sort({ type: 1, key: 1 }).lean();
      return { ...cropDto(crop, language), diseases: diseases.map((x) => toDisease(x, language)) };
    },

    async listDiseases(language, cropKey) {
      const rows = await DiseaseModel.find({ active: true, ...(cropKey ? { cropKey } : {}) }).sort({ cropKey: 1, key: 1 }).lean();
      return rows.map((x) => toDisease(x, language));
    },

    async getDisease(key, language) {
      const row = await DiseaseModel.findOne({ key, active: true }).lean();
      if (!row) throw Errors.notFound('Disease');
      return toDisease(row, language);
    },

    async diseasesForClassKeys(classKeys) {
      const rows = await DiseaseModel.find({ modelClassKeys: { $in: classKeys } }, { key: 1, cropKey: 1, type: 1, modelClassKeys: 1 }).lean();
      const out = new Map<string, { diseaseKey: string; cropKey: string; type: string }>();
      for (const r of rows) for (const ck of r.modelClassKeys ?? []) out.set(ck, { diseaseKey: r.key, cropKey: r.cropKey, type: r.type });
      return out;
    },

    async cropExists(key) {
      return (await CropModel.exists({ key, active: true })) !== null;
    },

    async updateCrop(key, patch, userId) {
      const $set: Record<string, unknown> = { managedBy: 'ADMIN', updatedBy: userId };
      if (patch.names) for (const [lang, value] of Object.entries(patch.names)) $set[`names.${lang}`] = value;
      if (patch.active !== undefined) $set.active = patch.active;
      if (patch.notes !== undefined) $set.notes = patch.notes;
      const row = await CropModel.findOneAndUpdate({ key }, { $set }, { new: true, runValidators: true }).lean();
      if (!row) throw Errors.notFound('Crop');
      return toCrop(row, 'en');
    },
  };
}
