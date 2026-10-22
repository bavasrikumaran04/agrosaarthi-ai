/**
 * Runtime view of which languages are enabled and what each configured
 * provider verifiably supports. Implemented by the languages module on top of
 * the LanguageCapability collection; other modules depend only on this
 * interface so that no module hard-codes Tamil (or any language).
 */
export type CapabilityChannel = 'stt' | 'tts' | 'ai' | 'telephony';

export interface LanguageSummary {
  code: string;
  name: string;
  nativeName: string;
  uiTranslation: boolean;
  isDefault: boolean;
}

export interface CapabilityMatch {
  provider: string;
  locale: string;
  voice?: string;
}

export interface LanguageRegistry {
  isEnabled(code: string): Promise<boolean>;
  listEnabled(): Promise<LanguageSummary[]>;
  defaultLanguage(): Promise<string>;
  /** Locale/voice to use for `provider` on `channel`, or null when not verified as SUPPORTED. */
  capability(code: string, channel: CapabilityChannel, provider: string): Promise<CapabilityMatch | null>;
}

/** Version of the privacy notice farmers accept; bump when the notice text changes. */
export const PRIVACY_NOTICE_VERSION = '2026-10-22';
