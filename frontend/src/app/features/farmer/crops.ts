import { Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../core/api';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n';
import type { Crop, CropDetail } from '../../core/models';

@Component({
  selector: 'app-crops',
  imports: [RouterLink, TranslatePipe],
  template: `
    <section class="stack">
      <h1>{{ 'crops.title' | t }}</h1>
      <p>{{ 'crops.lead' | t }}</p>
      @if (loading()) {<p role="status"><span class="spinner" aria-hidden="true"></span> {{ 'app.loading' | t }}</p>}
      @if (error()) {<div class="alert alert-danger" role="alert">{{ error() }} <button class="btn-link" (click)="load()">{{ 'app.retry' | t }}</button></div>}
      <div class="grid">
        @for (c of crops(); track c.key) {
          <a class="card" [routerLink]="['/crops', c.key]">
            <h2>{{ c.name }}</h2>
            @if (c.scientificName) {<p class="muted small"><i>{{ c.scientificName }}</i></p>}
            <span class="badge" [class.badge-ok]="c.supportedByModel" [class.badge-warn]="!c.supportedByModel">
              {{ (c.supportedByModel ? 'crops.modelSupported' : 'crops.modelNotSupported') | t }}
            </span>
            @if (c.diseaseCount) {<p class="small">{{ 'crops.diseaseCount' | t: { count: c.diseaseCount } }}</p>}
          </a>
        }
      </div>
      <p class="muted small">{{ 'crops.reviewNote' | t }}</p>
    </section>
  `,
})
export class CropsPage {
  private readonly api = inject(ApiClient);
  private readonly i18n = inject(I18nService);
  protected readonly crops = signal<Crop[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.i18n.language();
      void this.load();
    });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.crops.set(await firstValueFrom(this.api.get<Crop[]>('/api/v1/crops', { language: this.i18n.language() })));
    } catch (err) {
      this.error.set(this.i18n.errorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }
}

@Component({
  selector: 'app-crop-detail',
  imports: [RouterLink, TranslatePipe],
  template: `
    <section class="stack">
      <a routerLink="/crops">← {{ 'app.back' | t }}</a>
      @if (error()) {<div class="alert alert-danger" role="alert">{{ error() }}</div>}
      @if (crop(); as c) {
        <h1>{{ c.name }}</h1>
        @if (c.scientificName) {<p class="muted"><i>{{ c.scientificName }}</i></p>}
        <span class="badge" [class.badge-ok]="c.supportedByModel" [class.badge-warn]="!c.supportedByModel">{{ (c.supportedByModel ? 'crops.modelSupported' : 'crops.modelNotSupported') | t }}</span>
        <h2>{{ 'crops.diseasesTitle' | t }}</h2>
        @if (c.diseases.length === 0) {<p>{{ 'admin.noData' | t }}</p>}
        <ul class="stack" style="list-style:none;padding:0">
          @for (d of c.diseases; track d.key) {
            <li class="card">
              <h3>{{ d.name }}</h3>
              <span class="badge">{{ 'crops.type.' + d.type | t }}</span>
              @if (d.causalAgent) {<p class="small">{{ 'crops.causalAgent' | t }}: <i>{{ d.causalAgent }}</i></p>}
            </li>
          }
        </ul>
        <div class="cluster">
          @if (c.supportedByModel) {<a class="btn btn-primary" routerLink="/analyze" [queryParams]="{ crop: c.key }">{{ 'nav.analyze' | t }}</a>}
          <a class="btn" routerLink="/ask" [queryParams]="{ crop: c.key }">{{ 'nav.ask' | t }}</a>
        </div>
      }
    </section>
  `,
})
export class CropDetailPage {
  private readonly api = inject(ApiClient);
  private readonly i18n = inject(I18nService);
  readonly key = input.required<string>();
  protected readonly crop = signal<CropDetail | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const key = this.key();
      const language = this.i18n.language();
      firstValueFrom(this.api.get<CropDetail>(`/api/v1/crops/${encodeURIComponent(key)}`, { language }))
        .then((c) => this.crop.set(c))
        .catch((e) => this.error.set(this.i18n.errorMessage(e)));
    });
  }
}
