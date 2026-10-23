import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../core/api';
import { AuthService } from '../../core/auth';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n';
import type { CaseDetail, CaseSummary } from '../../core/models';
import { Icon } from '../../shared/icon';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, TranslatePipe, DatePipe, Icon],
  template: `
    <section class="stack-lg">
      <div class="welcome">
        <div>
          <span class="eyebrow"><app-icon name="sprout" [size]="18" /> {{ 'dashboard.eyebrow' | t }}</span>
          <h1>{{ 'dashboard.title' | t: { name: auth.user()?.name ?? '' } }}</h1>
          <p class="lead">{{ 'dashboard.lead' | t }}</p>
        </div>
      </div>
      <div class="tiles">
        <a class="tile primary" routerLink="/analyze"><span class="icon-chip lg"><app-icon name="camera" [size]="28" /></span><span>{{ 'nav.analyze' | t }}<small>{{ 'dashboard.analyzeHint' | t }}</small></span></a>
        <a class="tile" routerLink="/ask"><span class="icon-chip lg"><app-icon name="chat" [size]="28" /></span><span>{{ 'nav.ask' | t }}<small>{{ 'dashboard.askHint' | t }}</small></span></a>
        <a class="tile" routerLink="/crops"><span class="icon-chip lg accent"><app-icon name="leaf" [size]="28" /></span><span>{{ 'nav.crops' | t }}<small>{{ 'dashboard.cropsHint' | t }}</small></span></a>
        <a class="tile" routerLink="/phone-demo"><span class="icon-chip lg info"><app-icon name="phone" [size]="28" /></span><span>{{ 'nav.phoneDemo' | t }}<small>{{ 'dashboard.phoneHint' | t }}</small></span></a>
      </div>
      <section class="stack">
        <div class="page-head"><h2>{{ 'dashboard.recentCases' | t }}</h2>@if (cases().length) {<a routerLink="/cases" class="back-link">{{ 'dashboard.viewAll' | t }} <app-icon name="arrow" [size]="18" /></a>}</div>
        @if (loading()) {<p class="loading" role="status"><span class="spinner" aria-hidden="true"></span> {{ 'app.loading' | t }}</p>}
        @if (cases().length === 0 && !loading()) {
          <div class="empty"><span class="icon-chip lg"><app-icon name="clipboard" [size]="28" /></span><p>{{ 'dashboard.noCases' | t }}</p><a class="btn btn-primary" routerLink="/analyze"><app-icon name="camera" /> {{ 'nav.analyze' | t }}</a></div>
        }
        <ul class="record-list">
          @for (c of cases(); track c.id) {
            <li><a class="card record" [routerLink]="['/cases', c.id]">
              <span class="icon-chip"><app-icon [name]="c.latestAnalysis ? 'camera' : 'chat'" /></span>
              <span class="grow"><span class="title">{{ c.caseNumber }}</span>
                <p class="small muted truncate">{{ c.symptomsPreview || c.latestAnalysis?.topLabel || '' }} · {{ c.createdAt | date: 'mediumDate' }}</p></span>
              <span class="badge" [class]="'badge status-' + c.status">{{ 'cases.statusLabel.' + c.status | t }}</span>
            </a></li>
          }
        </ul>
      </section>
    </section>
  `,
  styles: `.welcome{padding:var(--space-5);border-radius:var(--radius-lg);background:linear-gradient(135deg,var(--c-primary-soft),#f6faf3);border:1px solid var(--c-border)}.welcome h1{margin-bottom:var(--space-2)}.welcome .lead{margin:0}`,
})
export class DashboardPage {
  private readonly api = inject(ApiClient);
  protected readonly auth = inject(AuthService);
  protected readonly cases = signal<CaseSummary[]>([]);
  protected readonly loading = signal(true);
  constructor() {
    firstValueFrom(this.api.getPage<CaseSummary>('/api/v1/cases', { pageSize: 5 }))
      .then((r) => this.cases.set(r.items))
      .catch(() => undefined)
      .finally(() => this.loading.set(false));
  }
}

@Component({
  selector: 'app-cases',
  imports: [RouterLink, TranslatePipe, DatePipe, Icon],
  template: `
    <section class="stack">
      <div class="page-head"><h1>{{ 'cases.title' | t }}</h1><a class="btn btn-primary" routerLink="/analyze"><app-icon name="camera" /> {{ 'nav.analyze' | t }}</a></div>
      @if (loading()) {<p class="loading" role="status"><span class="spinner" aria-hidden="true"></span> {{ 'app.loading' | t }}</p>}
      @if (error()) {<div class="alert alert-danger" role="alert">{{ error() }}</div>}
      @if (!loading() && !error() && cases().length === 0) {
        <div class="empty"><span class="icon-chip lg"><app-icon name="clipboard" [size]="28" /></span><p>{{ 'cases.empty' | t }}</p></div>
      }
      <ul class="record-list">
        @for (c of cases(); track c.id) {
          <li><a class="card record" [routerLink]="['/cases', c.id]">
            <span class="icon-chip"><app-icon [name]="c.latestAnalysis ? 'camera' : 'chat'" /></span>
            <span class="grow">
              <span class="title">{{ c.caseNumber }}</span> @if (c.latestAnalysis?.simulated) {<span class="badge badge-danger">TEST</span>}
              <p class="small truncate">{{ c.symptomsPreview || c.latestAnalysis?.topLabel || '' }}</p>
              <p class="small muted">{{ 'cases.created' | t }}: {{ c.createdAt | date: 'medium' }}</p>
            </span>
            <span class="badge" [class]="'badge status-' + c.status">{{ 'cases.statusLabel.' + c.status | t }}</span>
          </a></li>
        }
      </ul>
    </section>
  `,
})
export class CasesPage {
  private readonly api = inject(ApiClient);
  private readonly i18n = inject(I18nService);
  protected readonly cases = signal<CaseSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  constructor() {
    firstValueFrom(this.api.getPage<CaseSummary>('/api/v1/cases', { pageSize: 50 }))
      .then((r) => this.cases.set(r.items))
      .catch((e) => this.error.set(this.i18n.errorMessage(e)))
      .finally(() => this.loading.set(false));
  }
}

@Component({
  selector: 'app-case-detail',
  imports: [RouterLink, TranslatePipe, DatePipe, FormsModule, Icon],
  template: `
    <section class="stack narrow">
      <a routerLink="/cases" class="back-link"><app-icon name="back" [size]="18" /> {{ 'app.back' | t }}</a>
      @if (error()) {<div class="alert alert-danger" role="alert">{{ error() }}</div>}
      @if (c(); as c) {
        <h1>{{ 'cases.detailTitle' | t: { number: c.caseNumber } }}</h1>
        <p><span class="badge" [class]="'badge status-' + c.status">{{ 'cases.statusLabel.' + c.status | t }}</span></p>
        @if (notice()) {<div class="alert alert-success" role="status">{{ notice() }}</div>}
        @if (c.symptomsText) {<div class="card"><h2>{{ 'cases.symptoms' | t }}</h2><p>{{ c.symptomsText }}</p></div>}
        @for (a of c.analyses; track a.id) {
          <div class="card">
            <h2>{{ 'cases.analysis' | t }}</h2>
            @if (a.model.simulated) {<div class="alert alert-danger"><strong>{{ 'app.simulatedBanner' | t }}</strong></div>}
            @if (!a.model.simulated && (a.model.name ?? '').toUpperCase().includes('TEST FIXTURE')) {<div class="alert alert-danger"><strong>{{ 'result.testModelNotice' | t }}</strong></div>}
            @if (a.outcome) {<p><strong>{{ 'result.outcome.' + a.outcome | t }}</strong></p>}
            @if ((a.outcome === 'LIKELY_MATCH' || a.outcome === 'UNCERTAIN') && a.predictions[0]) {
              <p>{{ 'result.possibleProblem' | t }}: {{ a.predictions[0].label }} ({{ 'result.sureness' | t: { percent: pct(a.predictions[0].score) } }})</p>
              <p class="small muted">{{ 'result.surenessNote' | t }}</p>
            }
          </div>
        }
        <div class="card">
          <h2>{{ 'cases.expertAnswers' | t }}</h2>
          @for (x of c.assessments; track x.id) {
            <div class="stack">
              <p><strong>{{ x.diagnosis }}</strong> <span class="badge">{{ 'cases.certainty.' + x.certainty | t }}</span></p>
              @if (x.recommendations) {<p style="white-space:pre-line">{{ x.recommendations }}</p>}
              <p class="small muted">{{ x.expertName }} · {{ x.createdAt | date: 'medium' }}</p>
            </div>
          } @empty {<p>{{ 'cases.noExpertAnswer' | t }}</p>}
        </div>
        <div class="card stack">
          <h2>{{ 'cases.messages' | t }}</h2>
          @for (m of c.messages; track m.id) {
            <div class="msg" [class.mine]="m.authorRole === 'FARMER'"><p class="small muted">{{ m.authorName }} · {{ m.createdAt | date: 'short' }}</p><p>{{ m.text }}</p></div>
          } @empty {<p>{{ 'cases.noMessages' | t }}</p>}
          @if (c.status !== 'CLOSED') {
            <label for="msg">{{ 'cases.writeMessage' | t }}</label>
            <textarea id="msg" [(ngModel)]="message" maxlength="4000"></textarea>
            <button class="btn" type="button" [disabled]="!message.trim() || busy()" (click)="send()">{{ 'cases.send' | t }}</button>
          }
        </div>
        @if (c.status !== 'CLOSED' && c.status !== 'RESOLVED') {
          @if (!c.escalation.required) {
            <button class="btn btn-block" type="button" (click)="escalate()" [disabled]="busy()">{{ 'cases.escalate' | t }}</button>
          } @else {<p class="alert">{{ 'cases.escalated' | t }}</p>}
          <div class="card stack">
            <h2>{{ 'cases.callbackTitle' | t }}</h2>
            @if (openCallback(c)) {<p>{{ 'cases.callbackRequested' | t }}</p>} @else {
              <fieldset class="choice-list choice-row">
                <legend>{{ 'cases.callbackWindow' | t }}</legend>
                @for (w of windows; track w) {
                  <label class="choice"><input type="radio" name="win" [value]="w" [(ngModel)]="window" /> {{ 'cases.window.' + w | t }}</label>
                }
              </fieldset>
              <label for="cbr">{{ 'cases.callbackReason' | t }}</label>
              <input id="cbr" type="text" [(ngModel)]="callbackReason" maxlength="500" />
              <button class="btn btn-primary btn-big" type="button" (click)="requestCallback()" [disabled]="busy()"><app-icon name="phone" /> {{ 'cases.callbackButton' | t }}</button>
            }
          </div>
        }
      }
    </section>
  `,
  styles: `.msg{background:var(--c-surface-2);border-radius:12px 12px 12px 4px;padding:.6rem .9rem;max-width:92%}.msg p{margin:0}.msg.mine{background:var(--c-primary-soft);margin-left:auto;border-radius:12px 12px 4px 12px}`,
})
export class CaseDetailPage {
  private readonly api = inject(ApiClient);
  private readonly i18n = inject(I18nService);
  readonly id = input.required<string>();
  protected readonly c = signal<CaseDetail | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly windows = ['MORNING', 'AFTERNOON', 'EVENING', 'ANY'] as const;
  protected message = '';
  protected window: (typeof this.windows)[number] = 'ANY';
  protected callbackReason = '';

  constructor() {
    effect(() => void this.load(this.id()));
  }

  protected pct(s: number): number {
    return Math.round(s * 100);
  }
  protected openCallback(c: CaseDetail): boolean {
    return c.callbacks.some((cb) => ['PENDING', 'SCHEDULED', 'IN_PROGRESS'].includes(cb.status));
  }

  private async load(id: string): Promise<void> {
    try {
      this.c.set(await firstValueFrom(this.api.get<CaseDetail>(`/api/v1/cases/${id}`)));
    } catch (e) {
      this.error.set(this.i18n.errorMessage(e));
    }
  }

  private async act(fn: () => Promise<unknown>, okKey?: string): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await fn();
      if (okKey) this.notice.set(this.i18n.t(okKey));
      await this.load(this.id());
    } catch (e) {
      this.error.set(this.i18n.errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected send(): Promise<void> {
    const text = this.message.trim();
    return this.act(async () => {
      await firstValueFrom(this.api.post(`/api/v1/cases/${this.id()}/messages`, { text }));
      this.message = '';
    });
  }
  protected escalate(): Promise<void> {
    return this.act(() => firstValueFrom(this.api.post(`/api/v1/cases/${this.id()}/escalate`, {})), 'cases.escalated');
  }
  protected requestCallback(): Promise<void> {
    return this.act(
      () => firstValueFrom(this.api.post(`/api/v1/cases/${this.id()}/callback`, { preferredTimeWindow: this.window, reason: this.callbackReason.trim() || undefined })),
      'cases.callbackRequested',
    );
  }
}
