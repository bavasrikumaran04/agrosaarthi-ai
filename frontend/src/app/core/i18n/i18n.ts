import { DOCUMENT } from '@angular/common';
import { Injectable, Pipe, PipeTransform, computed, inject, signal } from '@angular/core';
import { ApiError } from '../api';
import { en, type Dictionary, type TranslationKey } from './en';
import { ta } from './ta';

export type UiLanguage = 'ta' | 'en';
export const UI_LANGUAGES: Array<{ code: UiLanguage; nativeName: string }> = [
  { code: 'ta', nativeName: 'தமிழ்' },
  { code: 'en', nativeName: 'English' },
];
const DICTIONARIES: Record<UiLanguage, Dictionary> = { en, ta };
const STORAGE_KEY = 'agrosaarthi.language';

function lookup(dict: Dictionary, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

function readStored(): UiLanguage | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'ta' || v === 'en' ? v : null;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly document = inject(DOCUMENT);
  /** Tamil first: it is the default until the user chooses otherwise. */
  readonly language = signal<UiLanguage>(readStored() ?? 'ta');
  readonly hasChosen = signal(readStored() !== null);
  private readonly dict = computed(() => DICTIONARIES[this.language()]);

  constructor() {
    this.document.documentElement.lang = this.language();
  }

  setLanguage(code: UiLanguage): void {
    this.language.set(code);
    this.hasChosen.set(true);
    this.document.documentElement.lang = code;
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* storage may be unavailable (private mode); the choice still applies for this visit */
    }
  }

  t(key: TranslationKey | string, params?: Record<string, string | number>): string {
    const text = lookup(this.dict(), key) ?? lookup(en, key) ?? key;
    if (!params) return text;
    return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
  }

  /** Friendly, translated message for any error (never raw server text). */
  errorMessage(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 0) return this.t('errors.NETWORK');
      if (err.code === 'UNAUTHENTICATED' && err.message.toLowerCase().includes('invalid')) return this.t('errors.INVALID_CREDENTIALS');
      const known = lookup(en, `errors.${err.code}`);
      return known ? this.t(`errors.${err.code}`) : this.t('errors.UNKNOWN');
    }
    return this.t('errors.UNKNOWN');
  }
}

/** {{ 'nav.home' | t }} — impure so it updates when the language signal changes. */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  transform(key: TranslationKey | string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
}
