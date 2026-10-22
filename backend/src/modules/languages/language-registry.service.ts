import { LanguageCapabilityModel } from '../../db/models/language-capability.model.js';
import type { Logger } from '../../lib/logger.js';
import type {
  CapabilityChannel,
  CapabilityMatch,
  LanguageRegistry,
  LanguageSummary,
} from '../../shared/language-registry.js';

interface CachedLanguage {
  summary: LanguageSummary;
  enabled: boolean;
  capabilities: Record<CapabilityChannel, Array<{ provider: string; locale: string; status: string; voice?: string | null }>>;
}

/**
 * Baseline registry rows created on first start of an empty database. Provider
 * capability entries are intentionally empty here: they are added (with source
 * URLs) by `npm run db:seed` from verified research, or by administrators.
 */
export const BASELINE_LANGUAGES = [
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', enabled: true, uiTranslation: true, isDefault: true },
  { code: 'en', name: 'English', nativeName: 'English', enabled: true, uiTranslation: true, isDefault: false },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', enabled: false, uiTranslation: false, isDefault: false },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', enabled: false, uiTranslation: false, isDefault: false },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', enabled: false, uiTranslation: false, isDefault: false },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', enabled: false, uiTranslation: false, isDefault: false },
] as const;

export interface DbLanguageRegistry extends LanguageRegistry {
  /** Insert baseline rows that do not exist yet (never overwrites administrator changes). */
  ensureBaseline(): Promise<void>;
  invalidate(): void;
}

export function createLanguageRegistry(deps: { logger: Logger; cacheTtlMs?: number }): DbLanguageRegistry {
  const ttl = deps.cacheTtlMs ?? 30_000;
  let cache: { at: number; byCode: Map<string, CachedLanguage> } | undefined;

  const load = async (): Promise<Map<string, CachedLanguage>> => {
    if (cache && Date.now() - cache.at < ttl) return cache.byCode;
    const rows = await LanguageCapabilityModel.find({}).lean();
    const byCode = new Map<string, CachedLanguage>();
    for (const row of rows) {
      byCode.set(row.code, {
        enabled: row.enabled ?? false,
        summary: {
          code: row.code,
          name: row.name,
          nativeName: row.nativeName,
          uiTranslation: row.uiTranslation ?? false,
          isDefault: row.isDefault ?? false,
        },
        capabilities: {
          stt: row.stt ?? [],
          tts: row.tts ?? [],
          ai: row.ai ?? [],
          telephony: row.telephony ?? [],
        },
      });
    }
    cache = { at: Date.now(), byCode };
    return byCode;
  };

  return {
    async ensureBaseline() {
      for (const lang of BASELINE_LANGUAGES) {
        await LanguageCapabilityModel.updateOne({ code: lang.code }, { $setOnInsert: lang }, { upsert: true });
      }
      cache = undefined;
      deps.logger.debug('language registry baseline ensured');
    },
    invalidate() {
      cache = undefined;
    },
    async isEnabled(code) {
      return (await load()).get(code)?.enabled ?? false;
    },
    async listEnabled() {
      return [...(await load()).values()].filter((l) => l.enabled).map((l) => l.summary);
    },
    async defaultLanguage() {
      const all = [...(await load()).values()];
      return all.find((l) => l.enabled && l.summary.isDefault)?.summary.code ?? all.find((l) => l.enabled)?.summary.code ?? 'en';
    },
    async capability(code, channel, provider): Promise<CapabilityMatch | null> {
      const lang = (await load()).get(code);
      if (!lang?.enabled) return null;
      const entry = lang.capabilities[channel].find((c) => c.provider === provider && c.status === 'SUPPORTED');
      return entry ? { provider: entry.provider, locale: entry.locale, voice: entry.voice ?? undefined } : null;
    },
  };
}
