import { Injectable, NgZone, inject, signal } from '@angular/core';

/** Minimal typing for the (non-standard, prefixed) Web Speech API. */
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type Ctor = new () => SpeechRecognitionLike;

const LOCALES: Record<string, string> = { ta: 'ta-IN', en: 'en-IN' };

/**
 * Browser speech-to-text. Uses the browser's own recognition service (in Chrome
 * this sends audio to Google). Records a whole utterance — it is not real-time
 * conversation. When unsupported, the UI falls back to typing.
 */
@Injectable({ providedIn: 'root' })
export class VoiceInputService {
  private readonly zone = inject(NgZone);
  private recognition: SpeechRecognitionLike | null = null;
  readonly listening = signal(false);
  readonly supported = typeof window !== 'undefined' && Boolean(this.ctor());

  private ctor(): Ctor | undefined {
    const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
    return w.SpeechRecognition ?? w.webkitSpeechRecognition;
  }

  start(language: string, onText: (text: string) => void, onError: () => void): void {
    const C = this.ctor();
    if (!C) return onError();
    const r = new C();
    r.lang = LOCALES[language] ?? language;
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e) => {
      const text = Array.from(e.results).map((res) => res[0]?.transcript ?? '').join(' ').trim();
      this.zone.run(() => text && onText(text));
    };
    r.onerror = () => this.zone.run(onError);
    r.onend = () => this.zone.run(() => this.listening.set(false));
    this.recognition = r;
    this.listening.set(true);
    try {
      r.start();
    } catch {
      this.listening.set(false);
      onError();
    }
  }

  stop(): void {
    this.recognition?.stop();
    this.listening.set(false);
  }
}
