import { Component, OnDestroy, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../core/api';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n';
import type { Analysis, Crop } from '../../core/models';
import { AnalysisResultComponent } from './analysis-result';

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Component({
  selector: 'app-analyze',
  imports: [ReactiveFormsModule, TranslatePipe, AnalysisResultComponent],
  template: `
    <section class="stack narrow">
      <h1>{{ 'analyze.title' | t }}</h1>
      @if (!result()) {
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="stack">
          <div class="field">
            <span class="hint" id="photo-hint">{{ 'analyze.photoHint' | t }}</span>
            <label class="btn btn-big btn-block" for="photo">📷 {{ 'analyze.choosePhoto' | t }}</label>
            <input id="photo" class="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" aria-describedby="photo-hint" (change)="onFile($event)" />
            @if (fileError()) {<span class="error" role="alert">{{ fileError() }}</span>}
          </div>
          @if (previewUrl()) {<img [src]="previewUrl()" [alt]="'analyze.preview' | t" class="preview" />}
          <div class="field">
            <label for="crop">{{ 'analyze.cropLabel' | t }}</label>
            <select id="crop" formControlName="cropKey">
              <option value="">{{ 'analyze.cropUnknown' | t }}</option>
              @for (c of crops(); track c.key) {<option [value]="c.key">{{ c.name }}</option>}
            </select>
            @if (selectedUnsupported()) {<span class="hint" role="status">{{ 'analyze.unsupportedCropWarning' | t }}</span>}
          </div>
          <div class="field">
            <label for="symptoms">{{ 'analyze.symptomsLabel' | t }}</label>
            <span class="hint" id="sym-hint">{{ 'analyze.symptomsHint' | t }}</span>
            <textarea id="symptoms" formControlName="symptomsText" maxlength="2000" aria-describedby="sym-hint"></textarea>
          </div>
          @if (error()) {<div class="alert alert-danger" role="alert">{{ error() }}</div>}
          <div aria-live="polite">
            @if (progress() !== null && progress()! < 100) {
              <label for="up">{{ 'analyze.uploading' | t: { percent: progress()! } }}</label>
              <progress id="up" class="progress" max="100" [value]="progress()"></progress>
            } @else if (busy()) {
              <p role="status"><span class="spinner" aria-hidden="true"></span> {{ 'analyze.analysing' | t }}</p>
            }
          </div>
          <button class="btn btn-primary btn-big btn-block" type="submit" [disabled]="busy() || !file()">{{ 'analyze.submit' | t }}</button>
        </form>
      } @else {
        <app-analysis-result [analysis]="result()!" />
        <button class="btn" type="button" (click)="reset()">{{ 'analyze.choosePhoto' | t }}</button>
      }
    </section>
  `,
  styles: `.preview{max-height:18rem;border-radius:10px;border:1px solid var(--c-border);object-fit:contain;background:#fff}`,
})
export class AnalyzePage implements OnDestroy {
  private readonly api = inject(ApiClient);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);
  readonly crop = input<string>();
  protected readonly crops = signal<Crop[]>([]);
  protected readonly file = signal<File | null>(null);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly fileError = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly progress = signal<number | null>(null);
  protected readonly result = signal<Analysis | null>(null);
  protected readonly form = this.fb.group({ cropKey: [''], symptomsText: ['', Validators.maxLength(2000)] });
  private readonly cropKey = signal('');
  protected readonly selectedUnsupported = computed(() => {
    const c = this.crops().find((x) => x.key === this.cropKey());
    return c ? !c.supportedByModel : false;
  });

  constructor() {
    this.form.controls.cropKey.valueChanges.subscribe((v) => this.cropKey.set(v));
    firstValueFrom(this.api.get<Crop[]>('/api/v1/crops', { language: this.i18n.language() }))
      .then((c) => {
        this.crops.set(c);
        const pre = this.crop();
        if (pre && c.some((x) => x.key === pre)) this.form.controls.cropKey.setValue(pre);
      })
      .catch(() => this.crops.set([]));
  }

  protected onFile(ev: Event): void {
    const f = (ev.target as HTMLInputElement).files?.[0] ?? null;
    this.fileError.set(null);
    this.file.set(null);
    this.setPreview(null);
    if (!f) return;
    // Client-side checks are for convenience only; the server validates the real content.
    if (!TYPES.includes(f.type)) return this.fileError.set(this.i18n.t('analyze.errorType'));
    if (f.size > MAX_BYTES) return this.fileError.set(this.i18n.t('analyze.errorSize'));
    this.file.set(f);
    this.setPreview(URL.createObjectURL(f));
  }

  protected submit(): void {
    const f = this.file();
    if (!f) return;
    const v = this.form.getRawValue();
    const fd = new FormData();
    fd.append('image', f, f.name);
    fd.append('language', this.i18n.language());
    if (v.cropKey) fd.append('cropKey', v.cropKey);
    if (v.symptomsText.trim()) fd.append('symptomsText', v.symptomsText.trim());
    this.busy.set(true);
    this.error.set(null);
    this.progress.set(0);
    this.api.upload<Analysis>('/api/v1/image-analysis', fd).subscribe({
      next: (e) => (e.kind === 'progress' ? this.progress.set(e.percent) : this.result.set(e.data)),
      error: (err) => {
        this.error.set(this.i18n.errorMessage(err));
        this.busy.set(false);
        this.progress.set(null);
      },
      complete: () => {
        this.busy.set(false);
        this.progress.set(null);
      },
    });
  }

  protected reset(): void {
    this.result.set(null);
    this.file.set(null);
    this.setPreview(null);
    this.form.reset({ cropKey: '', symptomsText: '' });
  }

  private setPreview(url: string | null): void {
    const old = this.previewUrl();
    if (old) URL.revokeObjectURL(old);
    this.previewUrl.set(url);
  }

  ngOnDestroy(): void {
    this.setPreview(null);
  }
}
