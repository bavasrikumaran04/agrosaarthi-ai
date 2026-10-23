import { Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../core/api';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n';
import type { Crop } from '../../core/models';
import { FieldErrors } from '../../shared/field-errors';
import { VoiceInputService } from './voice-input';
import { Icon } from '../../shared/icon';


/**
 * Ask a question. The AI assistant is a later phase; today the question is sent
 * to an agricultural expert as a request — the page says so plainly.
 */
@Component({
  selector: 'app-ask',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, FieldErrors, Icon],
  template: `
    <section class="stack narrow">
      <div>
        <span class="eyebrow"><app-icon name="chat" [size]="18" /> {{ 'ask.eyebrow' | t }}</span>
        <h1>{{ 'ask.title' | t }}</h1>
        <p class="lead">{{ 'ask.lead' | t }}</p>
      </div>
      <div class="alert"><strong>{{ 'ask.aiNotice' | t }}</strong></div>
      @if (sentNumber()) {
        <div class="alert alert-success" role="status">
          <p>{{ 'ask.sent' | t: { number: sentNumber()! } }}</p>
          <a class="btn" [routerLink]="['/cases', sentId()]">{{ 'result.viewCase' | t }}</a>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="stack form-card">
          <div class="field">
            <label for="crop">{{ 'ask.cropLabel' | t }}</label>
            <select id="crop" formControlName="cropKey">
              <option value="">{{ 'analyze.cropUnknown' | t }}</option>
              @for (c of crops(); track c.key) {<option [value]="c.key">{{ c.name }}</option>}
            </select>
          </div>
          <div class="field">
            <label for="q">{{ 'ask.questionLabel' | t }}</label>
            <span class="hint" id="q-hint">{{ 'ask.questionHint' | t }}</span>
            <textarea id="q" formControlName="question" maxlength="2000" aria-describedby="q-hint q-err" [attr.aria-invalid]="form.controls.question.invalid && tick() > 0"></textarea>
            <app-field-errors [control]="form.controls.question" id="q-err" [tick]="tick()" />
          </div>
          @if (voice.supported) {
            <div class="cluster">
              @if (!voice.listening()) {
                <button type="button" class="btn btn-big" (click)="listen()"><app-icon name="mic" /> {{ 'ask.voiceStart' | t }}</button>
              } @else {
                <button type="button" class="btn btn-big btn-danger" (click)="voice.stop()"><app-icon name="close" /> {{ 'ask.voiceStop' | t }}</button>
                <span role="status">{{ 'ask.voiceListening' | t }}</span>
              }
            </div>
            <p class="small muted">{{ 'ask.voicePrivacy' | t }}</p>
          } @else {
            <p class="small muted">{{ 'ask.voiceUnsupported' | t }}</p>
          }
          @if (voiceError()) {<p class="error" role="alert">{{ 'ask.voiceError' | t }}</p>}
          <div class="field">
            <label for="district">{{ 'ask.districtLabel' | t }}</label>
            <input id="district" type="text" formControlName="district" />
          </div>
          @if (error()) {<div class="alert alert-danger" role="alert">{{ error() }}</div>}
          <button class="btn btn-primary btn-big btn-block" type="submit" [disabled]="busy()">{{ 'ask.submit' | t }}</button>
        </form>
      }
    </section>
  `,
})
export class AskPage {
  private readonly api = inject(ApiClient);
  private readonly i18n = inject(I18nService);
  protected readonly voice = inject(VoiceInputService);
  private readonly fb = inject(NonNullableFormBuilder);
  readonly crop = input<string>();
  protected readonly crops = signal<Crop[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly voiceError = signal(false);
  protected readonly sentNumber = signal<string | null>(null);
  protected readonly sentId = signal<string | null>(null);
  protected readonly tick = signal(0);
  protected readonly form = this.fb.group({
    cropKey: [''],
    question: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(2000)]],
    district: [''],
  });

  constructor() {
    firstValueFrom(this.api.get<Crop[]>('/api/v1/crops', { language: this.i18n.language() }))
      .then((c) => {
        this.crops.set(c);
        if (this.crop()) this.form.controls.cropKey.setValue(this.crop()!);
      })
      .catch(() => undefined);
  }

  protected listen(): void {
    this.voiceError.set(false);
    this.voice.start(
      this.i18n.language(),
      (text) => {
        const cur = this.form.controls.question.value;
        this.form.controls.question.setValue(cur ? `${cur} ${text}` : text);
      },
      () => this.voiceError.set(true),
    );
  }

  protected async submit(): Promise<void> {
    this.tick.update((n) => n + 1);
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const v = this.form.getRawValue();
      const r = await firstValueFrom(
        this.api.post<{ id: string; caseNumber: string }>('/api/v1/cases', {
          language: this.i18n.language(),
          cropKey: v.cropKey || undefined,
          symptomsText: v.question.trim(),
          district: v.district.trim() || undefined,
        }),
      );
      this.sentNumber.set(r.caseNumber);
      this.sentId.set(r.id);
    } catch (err) {
      this.error.set(this.i18n.errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}
