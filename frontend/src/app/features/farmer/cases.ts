import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../core/api';
import { AuthService } from '../../core/auth';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n';
import type { CaseDetail, CaseSummary } from '../../core/models';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, TranslatePipe, DatePipe],
  template: `
    <section class="stack">
      <h1>{{ 'dashboard.title' | t: { name: auth.user()?.name ?? '' } }}</h1>
      <p>{{ 'dashboard.lead' | t }}</p>
      <div class="grid">
        <a class="btn btn-primary btn-big" routerLink="/analyze">📷 {{ 'nav.analyze' | t }}</a>
        <a class="btn btn-big" routerLink="/ask">💬 {{ 'nav.ask' | t }}</a>
        <a class="btn btn-big" routerLink="/crops">🌾 {{ 'nav.crops' | t }}</a>
      </div>
      <h2>{{ 'dashboard.recentCases' | t }}</h2>
      @if (cases().length === 0 && !loading()) {<p>{{ 'dashboard.noCases' | t }}</p>}
      <ul class="stack" style="list-style:none;padding:0">
        @for (c of cases(); track c.id) {
          <li><a class="card" [routerLink]="['/cases', c.id]">
            <strong>{{ c.caseNumber }}</strong> · <span class="badge">{{ 'cases.statusLabel.' + c.status | t }}</span>
            <p class="small muted">{{ c.symptomsPreview || c.latestAnalysis?.topLabel || '' }} · {{ c.createdAt | date: 'mediumDate' }}</p>
          </a></li>
        }
      </ul>
      <a routerLink="/cases">{{ 'dashboard.viewAll' | t }} →</a>
    </section>
  `,
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
  imports: [RouterLink, TranslatePipe, DatePipe],
  template: `
    <section class="stack">
      <h1>{{ 'cases.title' | t }}</h1>
      @if (loading()) {<p role="status"><span class="spinner" aria-hidden="true"></span> {{ 'app.loading' | t }}</p>}
      @if (error()) {<div class="alert alert-danger" role="alert">{{ error() }}</div>}
      @if (!loading() && cases().length === 0) {<p>{{ 'cases.empty' | t }}</p><a class="btn btn-primary" routerLink="/analyze">{{ 'nav.analyze' | t }}</a>}
      <ul class="stack" style="list-style:none;padding:0">
        @for (c of cases(); track c.id) {
          <li><a class="card" [routerLink]="['/cases', c.id]">
            <div class="cluster"><strong>{{ c.caseNumber }}</strong><span class="badge">{{ 'cases.statusLabel.' + c.status | t }}</span>
              @if (c.latestAnalysis?.simulated) {<span class="badge badge-danger">TEST</span>}</div>
            <p class="small">{{ c.symptomsPreview || c.latestAnalysis?.topLabel || '' }}</p>
            <p class="small muted">{{ 'cases.created' | t }}: {{ c.createdAt | date: 'medium' }}</p>
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
  imports: [RouterLink, TranslatePipe, DatePipe, FormsModule],
  template: `
    <section class="stack narrow">
      <a routerLink="/cases">← {{ 'app.back' | t }}</a>
      @if (error()) {<div class="alert alert-danger" role="alert">{{ error() }}</div>}
      @if (c(); as c) {
        <h1>{{ 'cases.detailTitle' | t: { number: c.caseNumber } }}</h1>
        <p><span class="badge">{{ 'cases.statusLabel.' + c.status | t }}</span></p>
        @if (notice()) {<div class="alert alert-success" role="status">{{ notice() }}</div>}
        @if (c.symptomsText) {<div class="card"><h2>{{ 'cases.symptoms' | t }}</h2><p>{{ c.symptomsText }}</p></div>}
        @for (a of c.analyses; track a.id) {
          <div class="card">
            <h2>{{ 'cases.analysis' | t }}</h2>
            @if (a.model.simulated) {<div class="alert alert-danger"><strong>{{ 'app.simulatedBanner' | t }}</strong></div>}
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
              <fieldset class="choice-list" style="border:0;padding:0">
                <legend>{{ 'cases.callbackWindow' | t }}</legend>
                @for (w of windows; track w) {
                  <label class="choice"><input type="radio" name="win" [value]="w" [(ngModel)]="window" /> {{ 'cases.window.' + w | t }}</label>
                }
              </fieldset>
              <label for="cbr">{{ 'cases.callbackReason' | t }}</label>
              <input id="cbr" type="text" [(ngModel)]="callbackReason" maxlength="500" />
              <button class="btn btn-primary" type="button" (click)="requestCallback()" [disabled]="busy()">📞 {{ 'cases.callbackButton' | t }}</button>
            }
          </div>
        }
      }
    </section>
  `,
  styles: `.msg{border-left:4px solid var(--c-border);padding-left:.75rem}.msg.mine{border-color:var(--c-primary)}`,
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
