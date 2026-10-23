import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../core/api';
import { AuthService } from '../../core/auth';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n';
import type { CaseDetail, CaseStatus, CaseSummary } from '../../core/models';

type Scope = 'assigned' | 'unassigned' | 'resolved';

@Component({
  selector: 'app-expert-dashboard',
  imports: [RouterLink, TranslatePipe, DatePipe, FormsModule],
  template: `
    <section class="stack">
      <h1>{{ 'expert.title' | t }}</h1>
      @if (stats(); as s) {
        <div class="grid">
          <div class="card"><div class="stat">{{ s['assignedOpen'] }}</div>{{ 'expert.assignedOpen' | t }}</div>
          <div class="card"><div class="stat">{{ s['unassigned'] }}</div>{{ 'expert.unassigned' | t }}</div>
          <div class="card"><div class="stat">{{ s['pendingCallbacks'] }}</div>{{ 'expert.pendingCallbacks' | t }}</div>
          <div class="card"><div class="stat">{{ s['resolvedLast7Days'] }}</div>{{ 'expert.resolved7' | t }}</div>
          <div class="card" [class.alert-danger]="s['failedAnalysesLast24h'] > 0"><div class="stat">{{ s['failedAnalysesLast24h'] }}</div>{{ 'expert.failedAnalyses' | t }}</div>
          <div class="card"><div class="stat">{{ s['flaggedOpen'] }}</div>{{ 'expert.flagged' | t }}</div>
        </div>
      }
      <div class="tabs" role="tablist">
        @for (tab of tabs; track tab.scope) {
          <button role="tab" type="button" [attr.aria-selected]="scope() === tab.scope" (click)="setScope(tab.scope)">{{ tab.label | t }}</button>
        }
      </div>
      <form class="cluster" role="search" (ngSubmit)="load()">
        <label class="visually-hidden" for="q">{{ 'expert.search' | t }}</label>
        <input id="q" type="search" [(ngModel)]="q" name="q" [placeholder]="'expert.search' | t" style="max-width:24rem" />
        <button class="btn" type="submit">🔍</button>
      </form>
      @if (error()) {<div class="alert alert-danger" role="alert">{{ error() }}</div>}
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>{{ 'cases.number' | t }}</th><th>{{ 'cases.status' | t }}</th><th>{{ 'expert.priority' | t }}</th><th>{{ 'ask.cropLabel' | t }}</th><th>{{ 'cases.symptoms' | t }}</th><th>{{ 'cases.created' | t }}</th></tr></thead>
          <tbody>
            @for (c of cases(); track c.id) {
              <tr>
                <td><a [routerLink]="['/expert/cases', c.id]">{{ c.caseNumber }}</a> @if (c.escalated) {<span class="badge badge-warn">!</span>} @if (c.latestAnalysis?.simulated) {<span class="badge badge-danger">TEST</span>}</td>
                <td>{{ c.status }}</td>
                <td>{{ c.priority }}</td>
                <td>{{ c.cropKey ?? '—' }}</td>
                <td class="small">{{ c.symptomsPreview || c.latestAnalysis?.topLabel || '' }}</td>
                <td class="small">{{ c.createdAt | date: 'short' }}</td>
              </tr>
            } @empty {<tr><td colspan="6">{{ 'admin.noData' | t }}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class ExpertDashboardPage {
  private readonly api = inject(ApiClient);
  private readonly i18n = inject(I18nService);
  protected readonly tabs: Array<{ scope: Scope; label: string }> = [
    { scope: 'assigned', label: 'expert.tabAssigned' },
    { scope: 'unassigned', label: 'expert.tabUnassigned' },
    { scope: 'resolved', label: 'expert.tabResolved' },
  ];
  protected readonly scope = signal<Scope>('assigned');
  protected readonly cases = signal<CaseSummary[]>([]);
  protected readonly stats = signal<Record<string, number> | null>(null);
  protected readonly error = signal<string | null>(null);
  protected q = '';

  constructor() {
    firstValueFrom(this.api.get<Record<string, number>>('/api/v1/cases/dashboard')).then((s) => this.stats.set(s)).catch(() => undefined);
    void this.load();
  }

  protected setScope(s: Scope): void {
    this.scope.set(s);
    void this.load();
  }

  async load(): Promise<void> {
    this.error.set(null);
    try {
      const r = await firstValueFrom(this.api.getPage<CaseSummary>('/api/v1/cases', { scope: this.scope(), q: this.q.trim() || undefined, pageSize: 50 }));
      this.cases.set(r.items);
    } catch (e) {
      this.error.set(this.i18n.errorMessage(e));
    }
  }
}

@Component({
  selector: 'app-expert-case',
  imports: [RouterLink, TranslatePipe, DatePipe, FormsModule],
  template: `
    <section class="stack">
      <a routerLink="/expert">← {{ 'app.back' | t }}</a>
      @if (error()) {<div class="alert alert-danger" role="alert">{{ error() }}</div>}
      @if (notice()) {<div class="alert alert-success" role="status">{{ notice() }}</div>}
      @if (c(); as c) {
        <h1>{{ c.caseNumber }} <span class="badge">{{ c.status }}</span> <span class="badge">{{ c.priority }}</span></h1>
        @if (c.view === 'TRIAGE') {
          <div class="alert alert-warning">{{ 'expert.triageView' | t }}</div>
          <button class="btn btn-primary" type="button" (click)="take()" [disabled]="busy()">{{ 'expert.take' | t }}</button>
        }
        <div class="grid two">
          <div class="stack">
            <div class="card">
              <h2>{{ 'cases.symptoms' | t }}</h2>
              <p>{{ c.symptomsText || '—' }}</p>
              <p class="small muted">{{ c.cropKey ?? '' }} · {{ c.language }} · {{ c.channel }} · {{ c.createdAt | date: 'medium' }}</p>
              @if (c.escalation.required) {<p><strong>{{ 'expert.escalationReasons' | t }}:</strong> {{ c.escalation.reasons.join(', ') }}</p>}
            </div>
            @if (c.farmer) {
              <div class="card">
                <h2>{{ 'expert.farmer' | t }}</h2>
                <p>{{ c.farmer.name }} · {{ c.farmer.phoneMasked }}</p>
                @if (phone()) {<p><strong>{{ 'expert.revealed' | t: { phone: phone()! } }}</strong></p>} @else {
                  <button class="btn" type="button" (click)="reveal()">{{ 'expert.revealPhone' | t }}</button>
                }
              </div>
            }
            @for (a of c.analyses; track a.id) {
              <div class="card">
                <h2>{{ 'expert.analysisTitle' | t }}</h2>
                @if (a.model.simulated) {<div class="alert alert-danger"><strong>{{ 'app.simulatedBanner' | t }}</strong></div>}
                @if (images()[a.id]) {<img [src]="images()[a.id]" alt="" class="leaf" />} @else {<button class="btn" type="button" (click)="loadImage(a.id)">🖼</button>}
                <p>{{ a.outcome }} · {{ a.model.name }} {{ a.model.version }}</p>
                <ul>@for (p of a.predictions; track $index) {<li>{{ p.label }} — {{ pct(p.score) }}%</li>}</ul>
                @if (a.qualityIssues.length) {<p class="small">{{ a.qualityIssues.join(', ') }}</p>}
                <p class="small muted">{{ 'expert.modelScoreNote' | t }}</p>
              </div>
            }
            @if (c.aiSummary) {<div class="card"><h2>{{ 'expert.aiSummary' | t }}</h2><p>{{ c.aiSummary.text }}</p></div>}
            @if (c.sources.length) {
              <div class="card"><h2>{{ 'result.sources' | t }}</h2><ul class="small">@for (s of c.sources; track $index) {<li>{{ s.title }} — {{ s.sourceOrganization }} ({{ s.trustStatus }})</li>}</ul></div>
            }
          </div>
          @if (c.view === 'FULL') {
            <div class="stack">
              @if (c.allowedTransitions.length) {
                <div class="card stack">
                  <h2>{{ 'expert.changeStatus' | t }}</h2>
                  <label for="to" class="visually-hidden">{{ 'expert.changeStatus' | t }}</label>
                  <select id="to" [(ngModel)]="to">@for (s of c.allowedTransitions; track s) {<option [value]="s">{{ s }}</option>}</select>
                  <label for="note">{{ 'expert.note' | t }}</label>
                  <input id="note" type="text" [(ngModel)]="note" maxlength="2000" />
                  <button class="btn" type="button" (click)="setStatus()" [disabled]="busy() || !to">{{ 'expert.apply' | t }}</button>
                </div>
              }
              <div class="card stack">
                <h2>{{ 'expert.assessmentTitle' | t }}</h2>
                @for (x of c.assessments; track x.id) {<p class="small"><strong>{{ x.diagnosis }}</strong> ({{ x.certainty }}, AI: {{ x.aiAgreement }}) — {{ x.expertName }}</p>}
                <label for="dx">{{ 'expert.diagnosis' | t }}</label><input id="dx" type="text" [(ngModel)]="assessment.diagnosis" maxlength="1000" />
                <label for="cert">{{ 'expert.certaintyLabel' | t }}</label>
                <select id="cert" [(ngModel)]="assessment.certainty">@for (k of certainties; track k) {<option [value]="k">{{ 'cases.certainty.' + k | t }}</option>}</select>
                <label for="rec">{{ 'expert.recommendations' | t }}</label><textarea id="rec" [(ngModel)]="assessment.recommendations" maxlength="4000"></textarea>
                <label for="agree">{{ 'expert.aiAgreementLabel' | t }}</label>
                <select id="agree" [(ngModel)]="assessment.aiAgreement">@for (k of agreements; track k) {<option [value]="k">{{ 'expert.aiAgreement.' + k | t }}</option>}</select>
                <label class="check"><input type="checkbox" [(ngModel)]="assessment.visibleToFarmer" /> {{ 'expert.visibleToFarmer' | t }}</label>
                <button class="btn btn-primary" type="button" (click)="assess()" [disabled]="busy() || !assessment.diagnosis.trim()">{{ 'expert.saveAssessment' | t }}</button>
              </div>
              <div class="card stack">
                <h2>{{ 'cases.messages' | t }}</h2>
                @for (m of c.messages; track m.id) {<p class="small"><strong>{{ m.authorName ?? m.authorRole }}</strong> @if (m.internal) {<span class="badge">internal</span>}: {{ m.text }}</p>}
                <label for="msg">{{ 'cases.writeMessage' | t }}</label><textarea id="msg" [(ngModel)]="message" maxlength="4000"></textarea>
                <label class="check"><input type="checkbox" [(ngModel)]="internal" /> {{ 'expert.internalNote' | t }}</label>
                <button class="btn" type="button" (click)="send()" [disabled]="busy() || !message.trim()">{{ 'cases.send' | t }}</button>
              </div>
              <div class="card stack">
                <h2>{{ 'expert.callbacks' | t }}</h2>
                @for (cb of c.callbacks; track cb.id) {
                  <p>{{ cb.status }} · {{ 'cases.window.' + cb.preferredTimeWindow | t }} · {{ 'expert.attempts' | t: { count: cb.attempts } }}</p>
                  @if (cb.status === 'PENDING' || cb.status === 'SCHEDULED') {
                    <div class="cluster">@for (o of outcomes; track o) {<button class="btn" type="button" (click)="attempt(cb.id, o)">{{ 'expert.attemptOutcome.' + o | t }}</button>}</div>
                  }
                } @empty {<p>{{ 'app.none' | t }}</p>}
              </div>
              <div class="card"><h2>{{ 'expert.history' | t }}</h2><ul class="small">@for (h of c.statusHistory; track $index) {<li>{{ h.at | date: 'short' }}: {{ h.from ?? '—' }} → {{ h.to }} ({{ h.byRole }}) {{ h.note }}</li>}</ul></div>
            </div>
          }
        </div>
      }
    </section>
  `,
  styles: `.leaf{max-height:16rem;border-radius:10px}@media(min-width:900px){.two{grid-template-columns:1fr 1fr}}`,
})
export class ExpertCasePage {
  private readonly api = inject(ApiClient);
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);
  readonly id = input.required<string>();
  protected readonly c = signal<CaseDetail | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly phone = signal<string | null>(null);
  protected readonly images = signal<Record<string, string>>({});
  protected readonly certainties = ['CONFIRMED', 'PROBABLE', 'UNCERTAIN'] as const;
  protected readonly agreements = ['AGREES', 'PARTIALLY_AGREES', 'DISAGREES', 'NOT_APPLICABLE'] as const;
  protected readonly outcomes = ['CONNECTED', 'NO_ANSWER', 'BUSY', 'WRONG_NUMBER'] as const;
  protected to: CaseStatus | '' = '';
  protected note = '';
  protected message = '';
  protected internal = false;
  protected assessment = { diagnosis: '', certainty: 'PROBABLE' as const as string, recommendations: '', aiAgreement: 'AGREES' as string, visibleToFarmer: true };

  constructor() {
    effect(() => void this.load(this.id()));
  }

  protected pct(s: number): number {
    return Math.round(s * 100);
  }

  private async load(id: string): Promise<void> {
    try {
      const c = await firstValueFrom(this.api.get<CaseDetail>(`/api/v1/cases/${id}`));
      this.c.set(c);
      this.to = c.allowedTransitions[0] ?? '';
    } catch (e) {
      this.error.set(this.i18n.errorMessage(e));
    }
  }

  private async act(fn: () => Promise<unknown>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      await fn();
      await this.load(this.id());
    } catch (e) {
      this.error.set(this.i18n.errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected take(): Promise<void> {
    return this.act(() => firstValueFrom(this.api.post(`/api/v1/cases/${this.id()}/assign`, { expertId: this.auth.user()!.id })));
  }
  protected setStatus(): Promise<void> {
    return this.act(() => firstValueFrom(this.api.post(`/api/v1/cases/${this.id()}/status`, { to: this.to, note: this.note.trim() || undefined })).then(() => (this.note = '')));
  }
  protected assess(): Promise<void> {
    return this.act(() => firstValueFrom(this.api.post(`/api/v1/cases/${this.id()}/assessments`, { ...this.assessment, diagnosis: this.assessment.diagnosis.trim() })).then(() => (this.assessment.diagnosis = '')));
  }
  protected send(): Promise<void> {
    return this.act(() => firstValueFrom(this.api.post(`/api/v1/cases/${this.id()}/messages`, { text: this.message.trim(), internal: this.internal })).then(() => (this.message = '')));
  }
  protected attempt(callbackId: string, outcome: string): Promise<void> {
    return this.act(() => firstValueFrom(this.api.post(`/api/v1/cases/callbacks/${callbackId}/attempts`, { outcome })));
  }
  protected async reveal(): Promise<void> {
    try {
      const r = await firstValueFrom(this.api.post<{ phone: string }>(`/api/v1/cases/${this.id()}/reveal-contact`, {}));
      this.phone.set(r.phone);
    } catch (e) {
      this.error.set(this.i18n.errorMessage(e));
    }
  }
  protected async loadImage(analysisId: string): Promise<void> {
    try {
      const r = await firstValueFrom(this.api.get<{ url: string }>(`/api/v1/image-analysis/${analysisId}/image-url`));
      this.images.update((m) => ({ ...m, [analysisId]: r.url }));
    } catch (e) {
      this.error.set(this.i18n.errorMessage(e));
    }
  }
}
