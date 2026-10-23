import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/i18n';
import type { Analysis } from '../../core/models';

/** Presents a model result as possibilities with uncertainty, sources and an expert path. */
@Component({
  selector: 'app-analysis-result',
  imports: [RouterLink, TranslatePipe],
  template: `
    @let a = analysis();
    <section class="stack" aria-live="polite">
      <h2>{{ 'result.title' | t }}</h2>
      @if (a.simulated) {<div class="alert alert-danger" role="alert"><strong>{{ 'app.simulatedBanner' | t }}</strong></div>}
      @if (a.caseNumber) {<p class="muted">{{ 'result.caseNumber' | t: { number: a.caseNumber } }}</p>}
      @if (a.outcome) {
        <div class="alert" [class.alert-success]="a.outcome === 'LIKELY_MATCH'" [class.alert-warning]="a.outcome !== 'LIKELY_MATCH'">
          <p><strong>{{ 'result.outcome.' + a.outcome | t }}</strong></p>
          @for (q of a.qualityIssues; track q) {<p>{{ 'result.quality.' + q | t }}</p>}
          @if (a.outcome === 'POOR_QUALITY' || a.outcome === 'OUT_OF_DOMAIN') {<p>{{ 'result.tryAgainTips' | t }}</p>}
        </div>
      }
      @if (showPredictions() && a.predictions[0]; as top) {
        <div class="card">
          <h3>{{ 'result.possibleProblem' | t }}</h3>
          <p class="big">{{ top.label }}</p>
          <label class="small" [for]="'p-' + a.id">{{ 'result.sureness' | t: { percent: pct(top.score) } }}</label>
          <progress class="progress" [id]="'p-' + a.id" max="100" [value]="pct(top.score)"></progress>
          <p class="small muted">{{ 'result.surenessNote' | t }}</p>
          @if (a.predictions.length > 1) {
            <h4>{{ 'result.otherPossibilities' | t }}</h4>
            <ul>
              @for (p of a.predictions.slice(1); track p.classKey) {<li>{{ p.label }} — {{ pct(p.score) }}%</li>}
            </ul>
          }
          @if (a.model.name) {<p class="small muted">{{ 'result.model' | t: { name: a.model.name, version: a.model.version ?? '' } }}</p>}
        </div>
      }
      <div class="card">
        <h3>{{ 'result.guidanceTitle' | t }}</h3>
        @if (a.guidance?.text) {
          <p style="white-space:pre-line">{{ a.guidance!.text }}</p>
        } @else {
          <p>{{ 'result.noGuidance' | t }}</p>
        }
        @if (a.guidance?.sources?.length) {
          <h4>{{ 'result.sources' | t }}</h4>
          <ul class="small">
            @for (s of a.guidance!.sources; track $index) {
              <li>
                @if (s.sourceUrl) {<a [href]="s.sourceUrl" target="_blank" rel="noopener noreferrer">{{ s.title }}</a>} @else {{{ s.title }}}
                — {{ s.sourceOrganization }}
                @if (s.trustStatus !== 'EXPERT_REVIEWED') {<span class="badge badge-warn">{{ 'result.unreviewedSource' | t }}</span>}
              </li>
            }
          </ul>
        }
      </div>
      <div class="card">
        <h3>{{ 'result.expertTitle' | t }}</h3>
        @if (a.escalationRecommended) {<p><strong>{{ 'result.expertRecommended' | t }}</strong></p>}
        <a class="btn btn-primary" [routerLink]="['/cases', a.caseId]">{{ 'result.viewCase' | t }}</a>
      </div>
    </section>
  `,
  styles: `.big{font-size:1.3rem;font-weight:700;margin-bottom:.25rem}`,
})
export class AnalysisResultComponent {
  readonly analysis = input.required<Analysis>();
  protected pct(score: number): number {
    return Math.round(score * 100);
  }
  /** Never show a "possible problem" for unreadable / off-domain photos. */
  protected showPredictions(): boolean {
    const o = this.analysis().outcome;
    return o === 'LIKELY_MATCH' || o === 'UNCERTAIN';
  }
}
