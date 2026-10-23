import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../core/api';
import { AuthService } from '../../core/auth';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n';
import { Icon } from '../../shared/icon';
import { VoiceInputService } from '../farmer/voice-input';

type CallLang = 'ta' | 'en';
type Step = 'idle' | 'lang' | 'menu' | 'crop' | 'record' | 'confirm' | 'window' | 'saving' | 'ended';
interface Turn { who: 'system' | 'caller'; text: string }

/** Spoken prompts of the phone menu, in the language the caller chose (independent of the page language). */
type PromptKey = 'menu' | 'crop' | 'record' | 'confirm' | 'window' | 'tips' | 'sent' | 'demoOnly' | 'failed' | 'invalid' | 'goodbye';
const PROMPTS: Record<CallLang, Record<PromptKey, string>> = {
  ta: {
    menu: 'பயிர் பிரச்சனையைச் சொல்ல 1-ஐ அழுத்தவும். பாதுகாப்புக் குறிப்புகளுக்கு 2. நிபுணர் உங்களைத் திரும்ப அழைக்க 3. மீண்டும் கேட்க 0.',
    crop: 'எந்தப் பயிர்? நெல்லுக்கு 1. தக்காளிக்கு 2. வாழைக்கு 3. மற்ற பயிர்களுக்கு 4.',
    record: 'பிரச்சனையைச் சொல்லுங்கள்: என்ன தெரிகிறது, எப்போதிலிருந்து, வயலில் எவ்வளவு பகுதி பாதிக்கப்பட்டுள்ளது.',
    confirm: 'நீங்கள் சொன்னது: {text}. நிபுணருக்கு அனுப்ப 1. மீண்டும் சொல்ல 2.',
    window: 'நிபுணர் எப்போது அழைக்கலாம்? காலை 1. மதியம் 2. மாலை 3. எந்த நேரமும் 4.',
    tips: 'பூச்சிக்கொல்லிகளை நீங்களே கலக்க வேண்டாம். பொருளின் லேபிளில் உள்ள அளவை மட்டும் பயன்படுத்துங்கள். தெளிக்கும் போது கையுறை மற்றும் முகக்கவசம் அணியுங்கள். உள்ளூர் வேளாண் அலுவலரை அணுகுங்கள்.',
    sent: 'உங்கள் கோரிக்கை பதிவு செய்யப்பட்டது. கோரிக்கை எண் {number}. வேளாண் நிபுணர் உங்களை அழைக்க முயற்சிப்பார். சரியான நேரத்தை உறுதியளிக்க முடியாது. நன்றி.',
    demoOnly: 'இது செயல்விளக்கம் மட்டுமே. உண்மையான சேவையில் இந்தக் கோரிக்கை நிபுணருக்கு அனுப்பப்படும். நன்றி.',
    failed: 'மன்னிக்கவும், கோரிக்கையைப் பதிவு செய்ய முடியவில்லை. பிறகு மீண்டும் அழைக்கவும்.',
    invalid: 'மன்னிக்கவும், அது சரியான தேர்வு அல்ல.',
    goodbye: 'அழைத்ததற்கு நன்றி. வணக்கம்.',
  },
  en: {
    menu: 'To report a crop problem, press 1. For safety tips, press 2. To ask an expert to call you back, press 3. To hear this again, press 0.',
    crop: 'Which crop? For rice, press 1. For tomato, press 2. For banana, press 3. For any other crop, press 4.',
    record: 'Please describe the problem: what you see, since when, and how much of the field is affected.',
    confirm: 'You said: {text}. To send it to an expert, press 1. To say it again, press 2.',
    window: 'When can the expert call you? Morning, press 1. Afternoon, press 2. Evening, press 3. Any time, press 4.',
    tips: 'Never mix pesticides yourself. Use only the dose on the product label. Wear gloves and a mask when spraying. Please consult your local agricultural officer.',
    sent: 'Your request is registered. Request number {number}. An agricultural expert will try to call you. We cannot promise an exact time. Thank you.',
    demoOnly: 'This is a demonstration only. In the real service this request would be sent to an expert. Thank you.',
    failed: 'Sorry, we could not register your request. Please call again later.',
    invalid: 'Sorry, that is not a valid choice.',
    goodbye: 'Thank you for calling. Goodbye.',
  },
};
const WELCOME = 'வணக்கம்! AgroSaarthi-க்கு வரவேற்கிறோம். தமிழுக்கு 1-ஐ அழுத்தவும். Welcome to AgroSaarthi. For English, press 2.';
const CROPS: Record<string, { key: string; ta: string; en: string } | undefined> = {
  '1': { key: 'rice', ta: 'நெல்', en: 'Rice' },
  '2': { key: 'tomato', ta: 'தக்காளி', en: 'Tomato' },
  '3': { key: 'banana', ta: 'வாழை', en: 'Banana' },
  '4': undefined,
};
const WINDOWS: Record<string, 'MORNING' | 'AFTERNOON' | 'EVENING' | 'ANY'> = { '1': 'MORNING', '2': 'AFTERNOON', '3': 'EVENING', '4': 'ANY' };
const DTMF: Record<string, [number, number]> = {
  '1': [697, 1209], '2': [697, 1336], '3': [697, 1477], '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
  '7': [852, 1209], '8': [852, 1336], '9': [852, 1477], '*': [941, 1209], '0': [941, 1336], '#': [941, 1477],
};

/**
 * Browser SIMULATOR of the planned telephone (IVR) line for farmers with basic phones.
 * No call is placed and no telephony provider is involved. When a farmer is signed in, the
 * request is saved through the normal case API and marked as coming from the simulator.
 */
@Component({
  selector: 'app-phone-demo',
  imports: [FormsModule, RouterLink, TranslatePipe, Icon],
  template: `
    <section class="stack">
      <div>
        <span class="eyebrow"><app-icon name="phone" [size]="18" /> {{ 'phone.eyebrow' | t }}</span>
        <h1>{{ 'phone.title' | t }}</h1>
        <p class="lead">{{ 'phone.lead' | t }}</p>
      </div>
      <div class="alert alert-warning" role="note"><strong>{{ 'phone.simBanner' | t }}</strong></div>
      @if (isFarmer()) {
        <p class="alert alert-success">{{ 'phone.signedInNote' | t: { name: auth.user()?.name ?? '' } }}</p>
      } @else {
        <p class="alert">{{ 'phone.signedOutNote' | t }} <a routerLink="/login">{{ 'nav.login' | t }}</a></p>
      }

      <div class="layout">
        <div class="handset" [class.active]="step() !== 'idle' && step() !== 'ended'">
          <div class="screen" aria-live="polite">
            <div class="screen-top small"><span>AgroSaarthi</span><span>{{ statusText() }}</span></div>
            <p class="prompt">{{ screen() }}</p>
            @if (step() === 'record') {
              <div class="record stack">
                @if (voice.supported) {
                  @if (!voice.listening()) {
                    <button type="button" class="btn btn-sm" (click)="listen()"><app-icon name="mic" [size]="18" /> {{ 'phone.speakNow' | t }}</button>
                  } @else {
                    <button type="button" class="btn btn-sm btn-danger" (click)="voice.stop()">{{ 'ask.voiceStop' | t }}</button>
                    <span class="small" role="status">{{ 'ask.voiceListening' | t }}</span>
                  }
                }
                <label class="small" for="said">{{ 'phone.typeInstead' | t }}</label>
                <textarea id="said" rows="3" [(ngModel)]="typed" maxlength="1500"></textarea>
                <button type="button" class="btn btn-sm btn-primary" [disabled]="!typed.trim()" (click)="useSpeech(typed)">{{ 'phone.useText' | t }}</button>
              </div>
            }
          </div>
          <div class="keypad" role="group" [attr.aria-label]="'phone.keypad' | t">
            @for (k of keys; track k) {
              <button type="button" class="key" [disabled]="!acceptsKeys()" (click)="press(k)" [attr.aria-label]="'phone.key' | t: { key: k }">{{ k }}</button>
            }
          </div>
          <div class="call-row">
            @if (step() === 'idle' || step() === 'ended') {
              <button type="button" class="btn btn-big call" (click)="startCall()"><app-icon name="phone" /> {{ 'phone.call' | t }}</button>
            } @else {
              <button type="button" class="btn btn-big hang" (click)="endCall()"><app-icon name="close" /> {{ 'phone.end' | t }}</button>
            }
          </div>
          <label class="check small voice-toggle"><input type="checkbox" [(ngModel)]="speakPrompts" /> {{ 'phone.voiceOn' | t }}</label>
          @if (speakPrompts && voiceMissing()) {<p class="small muted">{{ 'phone.voiceMissing' | t }}</p>}
        </div>

        <div class="stack">
          <div class="card">
            <div class="card-head"><span class="icon-chip"><app-icon name="clipboard" /></span><h2>{{ 'phone.transcript' | t }}</h2></div>
            @if (turns().length === 0) {<p class="muted">{{ 'phone.noTranscript' | t }}</p>}
            <ol class="turns">
              @for (t of turns(); track $index) {
                <li [class.caller]="t.who === 'caller'"><span class="who small">{{ (t.who === 'caller' ? 'phone.caller' : 'phone.system') | t }}</span>{{ t.text }}</li>
              }
            </ol>
            @if (savedCaseId()) {<a class="btn btn-primary" [routerLink]="['/cases', savedCaseId()]">{{ 'phone.openCase' | t }}</a>}
          </div>
          <div class="card">
            <h2>{{ 'phone.howTitle' | t }}</h2>
            <ol class="how">
              <li>{{ 'phone.how1' | t }}</li><li>{{ 'phone.how2' | t }}</li><li>{{ 'phone.how3' | t }}</li><li>{{ 'phone.how4' | t }}</li>
            </ol>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: `
    .layout { display: grid; gap: var(--space-5); align-items: start; }
    @media (min-width: 900px) { .layout { grid-template-columns: 22rem 1fr; } }
    .handset { background: linear-gradient(160deg, #26302a, #121814); border-radius: 36px; padding: var(--space-5) var(--space-4); box-shadow: var(--shadow); max-width: 22rem; width: 100%; margin: 0 auto; color: #e9f2eb; }
    .screen { background: #dfeee0; color: #17201a; border-radius: 14px; padding: var(--space-3) var(--space-4); min-height: 13rem; border: 3px solid #0b0f0c; }
    .handset.active .screen { background: #e9f7e9; }
    .screen-top { display: flex; justify-content: space-between; font-weight: 700; color: #35513c; border-bottom: 1px solid #b9d3bc; margin-bottom: var(--space-2); }
    .prompt { font-size: 1.02rem; line-height: 1.55; margin: 0 0 var(--space-2); }
    .record textarea { min-height: 4.5rem; font-size: 0.95rem; }
    .keypad { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-2); margin-top: var(--space-4); }
    .key { min-height: 52px; border-radius: 14px; border: 1px solid #3c4a40; background: #2d3830; color: #fff; font: inherit; font-size: 1.35rem; font-weight: 700; cursor: pointer; }
    .key:hover:not(:disabled) { background: #3a4a3e; }
    .key:active:not(:disabled) { background: #1e7a3a; }
    .key:disabled { opacity: 0.45; cursor: not-allowed; }
    .call-row { margin-top: var(--space-4); }
    .call-row .btn { width: 100%; border: none; color: #fff; }
    .call { background: #1e9a47; }
    .call:hover { background: #17833b; color: #fff; }
    .hang { background: #c62828; }
    .hang:hover { background: #a31f1f; color: #fff; }
    .voice-toggle { margin-top: var(--space-3); color: #e9f2eb; }
    .handset .muted { color: #b6c8ba; }
    .turns { list-style: none; padding: 0; margin: 0 0 var(--space-3); display: grid; gap: var(--space-2); max-height: 26rem; overflow-y: auto; }
    .turns li { background: var(--c-surface-2); border-radius: 12px 12px 12px 4px; padding: var(--space-2) var(--space-3); max-width: 92%; }
    .turns li.caller { background: var(--c-primary-soft); margin-left: auto; border-radius: 12px 12px 4px 12px; }
    .who { display: block; font-weight: 700; color: var(--c-muted); }
    .how li { margin-bottom: var(--space-2); }
  `,
})
export class PhoneDemoPage implements OnDestroy {
  private readonly api = inject(ApiClient);
  protected readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  protected readonly voice = inject(VoiceInputService);
  protected readonly keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
  protected readonly step = signal<Step>('idle');
  protected readonly screen = signal('');
  protected readonly turns = signal<Turn[]>([]);
  protected readonly savedCaseId = signal<string | null>(null);
  protected readonly voiceMissing = signal(false);
  protected readonly isFarmer = computed(() => this.auth.role() === 'FARMER');
  protected readonly acceptsKeys = computed(() => !['idle', 'ended', 'saving', 'record'].includes(this.step()));
  protected speakPrompts = true;
  protected typed = '';
  private lang: CallLang = 'ta';
  private crop: { key?: string; label: string } = { label: '' };
  private problem = '';
  private problemReported = false;
  private audio: AudioContext | null = null;

  protected statusText(): string {
    const s = this.step();
    return this.i18n.t(s === 'idle' ? 'phone.screenIdle' : s === 'ended' ? 'phone.screenEnded' : 'phone.screenInCall');
  }

  protected startCall(): void {
    this.turns.set([]);
    this.savedCaseId.set(null);
    this.problem = '';
    this.problemReported = false;
    this.crop = { label: '' };
    window.speechSynthesis?.cancel();
    this.step.set('lang');
    this.say(WELCOME, 'ta');
  }

  protected endCall(): void {
    window.speechSynthesis?.cancel();
    this.voice.stop();
    if (this.step() !== 'ended') this.say(PROMPTS[this.lang].goodbye);
    this.step.set('ended');
  }

  protected press(key: string): void {
    this.tone(key);
    window.speechSynthesis?.cancel(); // like a real IVR, a keypress interrupts the prompt
    this.turns.update((t) => [...t, { who: 'caller', text: `⌨ ${key}` }]);
    switch (this.step()) {
      case 'lang':
        if (key !== '1' && key !== '2') return this.say(WELCOME, 'ta');
        this.lang = key === '1' ? 'ta' : 'en';
        return this.go('menu');
      case 'menu':
        if (key === '1') return this.go('crop');
        if (key === '2') { this.say(PROMPTS[this.lang].tips); return this.go('menu'); }
        if (key === '3') { this.problemReported = false; return this.go('window'); }
        if (key === '0') return this.go('menu');
        return this.invalid('menu');
      case 'crop': {
        if (!(key in CROPS)) return this.invalid('crop');
        const c = CROPS[key];
        this.crop = c ? { key: c.key, label: c[this.lang] } : { label: this.lang === 'ta' ? 'மற்றவை' : 'Other' };
        return this.go('record');
      }
      case 'confirm':
        if (key === '1') { this.problemReported = true; return this.go('window'); }
        if (key === '2') return this.go('record');
        return this.invalid('confirm');
      case 'window':
        if (!WINDOWS[key]) return this.invalid('window');
        void this.save(WINDOWS[key]);
        return;
      default:
        return;
    }
  }

  protected listen(): void {
    this.voice.start(this.lang, (text) => this.useSpeech(text), () => undefined);
  }

  protected useSpeech(text: string): void {
    const said = text.trim();
    if (!said) return;
    this.problem = said;
    this.typed = '';
    this.turns.update((t) => [...t, { who: 'caller', text: `🎤 ${said}` }]);
    this.go('confirm');
  }

  private go(step: Step): void {
    this.step.set(step);
    const p = PROMPTS[this.lang];
    if (step === 'confirm') return this.say(p.confirm.replace('{text}', this.problem));
    this.say(p[step as PromptKey]);
  }

  private invalid(step: Step): void {
    this.say(PROMPTS[this.lang].invalid);
    this.go(step);
  }

  private async save(window: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'ANY'): Promise<void> {
    const p = PROMPTS[this.lang];
    if (!this.isFarmer()) {
      this.say(p.demoOnly);
      this.step.set('ended');
      return;
    }
    this.step.set('saving');
    const tag = this.lang === 'ta' ? '[தொலைபேசி செயல்விளக்கம்]' : '[Phone line simulator]';
    const fallback = this.lang === 'ta' ? 'தொலைபேசி வழியாக நிபுணர் அழைப்பு கோரப்பட்டது.' : 'Expert call back requested by phone.';
    const symptoms = `${tag} ${this.problemReported ? this.problem : fallback}`.slice(0, 2000);
    try {
      const created = await firstValueFrom(this.api.post<{ id: string; caseNumber: string }>('/api/v1/cases', {
        language: this.lang,
        symptomsText: symptoms,
        ...(this.crop.key ? { cropKey: this.crop.key } : this.crop.label ? { cropFreeText: this.crop.label } : {}),
      }));
      await firstValueFrom(this.api.post(`/api/v1/cases/${created.id}/callback`, { preferredTimeWindow: window, reason: tag }));
      this.savedCaseId.set(created.id);
      this.say(p.sent.replace('{number}', created.caseNumber));
    } catch {
      this.say(p.failed);
    }
    this.step.set('ended');
  }

  private say(text: string, lang: CallLang = this.lang): void {
    this.screen.set(text);
    this.turns.update((t) => [...t, { who: 'system', text }]);
    if (!this.speakPrompts || typeof window === 'undefined' || !window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    const locale = lang === 'ta' ? 'ta-IN' : 'en-IN';
    const voice = synth.getVoices().find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(lang === 'ta' ? 'ta' : 'en'));
    this.voiceMissing.set(lang === 'ta' && !voice);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = locale;
    if (voice) u.voice = voice;
    u.rate = 0.95;
    synth.speak(u);
  }

  /** Short dual-tone keypad sound, like a real phone. */
  private tone(key: string): void {
    const f = DTMF[key];
    if (!f || typeof AudioContext === 'undefined') return;
    try {
      this.audio ??= new AudioContext();
      const ctx = this.audio;
      const gain = ctx.createGain();
      gain.gain.value = 0.08;
      gain.connect(ctx.destination);
      for (const hz of f) {
        const o = ctx.createOscillator();
        o.frequency.value = hz;
        o.connect(gain);
        o.start();
        o.stop(ctx.currentTime + 0.15);
      }
    } catch {
      /* audio is optional */
    }
  }

  ngOnDestroy(): void {
    window.speechSynthesis?.cancel();
    this.voice.stop();
    void this.audio?.close();
  }
}
