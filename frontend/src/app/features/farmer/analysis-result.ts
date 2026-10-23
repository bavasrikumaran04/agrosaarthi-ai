import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/i18n';
import type { Analysis } from '../../core/models';
import { Icon } from '../../shared/icon';


/** Presents a model result as possibilities with uncertainty, sources and an expert path. */
@Component({
  selector: 'app-analysis-result',
  imports: [RouterLink, TranslatePipe, Icon],
  template: `
    @let a = analysis();
    <section class="stack" aria-live="polite">
      <h2>{{ 'result.title' | t }}</h2>
      @if (a.simulated) {<div class="alert alert-danger" role="alert"><strong>{{ 'app.simulatedBanner' | t }}</strong></div>}
      @if (!a.simulated && isTestModel()) {<div class="alert alert-danger" role="note"><strong>{{ 'result.testModelNotice' | t }}</strong></div>}
      @if (a.caseNumber) {<p class="muted">{{ 'result.caseNumber' | t: { number: a.caseNumber } }}</p>}
      @if (a.outcome) {
        <div class="alert" [class.alert-success]="a.outcome === 'LIKELY_MATCH'" [class.alert-warning]="a.outcome !== 'LIKELY_MATCH'">
          <p class="outcome"><app-icon [name]="a.outcome === 'LIKELY_MATCH' ? 'check' : 'alert'" /> <strong>{{ 'result.outcome.' + a.outcome | t }}</strong></p>
          @for (q of a.qualityIssues; track q) {<p>{{ 'result.quality.' + q | t }}</p>}
          @if (a.outcome === 'POOR_QUALITY' || a.outcome === 'OUT_OF_DOMAIN') {<p>{{ 'result.tryAgainTips' | t }}</p>}
        </div>
      }
      @if (showPredictions() && a.predictions[0]; as top) {
        <div class="card top-card">
          <div class="card-head"><span class="icon-chip lg"><app-icon name="leaf" [size]="28" /></span>
            <div><h3 class="small muted">{{ 'result.possibleProblem' | t }}</h3><p class="big">{{ top.label }}</p></div></div>
          <p class="small" [id]="'p-' + a.id">{{ 'result.sureness' | t: { percent: pct(top.score) } }}</p>
          <div class="meter" role="meter" aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="pct(top.score)" [attr.aria-labelledby]="'p-' + a.id"><span [style.width.%]="pct(top.score)"></span></div>
          <p class="small muted">{{ 'result.surenessNote' | t }}</p>
          @if (!a.simulated && !isTestModel()) {<p class="small lab-note">{{ 'result.labModelNote' | t }}</p>}
          @if (a.predictions.length > 1) {
            <h4>{{ 'result.otherPossibilities' | t }}</h4>
            <ul class="others">
              @for (p of a.predictions.slice(1); track p.classKey) {<li><span>{{ p.label }}</span><span class="small muted">{{ pct(p.score) }}%</span><span class="meter thin"><span [style.width.%]="pct(p.score)"></span></span></li>}
            </ul>
          }
          @if (a.model.name) {<p class="small muted model"><app-icon name="cpu" [size]="16" /> {{ 'result.model' | t: { name: a.model.name, version: a.model.version ?? '' } }}</p>}
        </div>
      }
      <div class="card">
        <div class="card-head"><span class="icon-chip"><app-icon name="book" /></span><h3>{{ 'result.guidanceTitle' | t }}</h3></div>
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
        <div class="card-head"><span class="icon-chip info"><app-icon name="expert" /></span><h3>{{ 'result.expertTitle' | t }}</h3></div>
        @if (a.escalationRecommended) {<p><strong>{{ 'result.expertRecommended' | t }}</strong></p>}
        <a class="btn btn-primary" [routerLink]="['/cases', a.caseId]">{{ 'result.viewCase' | t }} <app-icon name="arrow" [size]="18" /></a>
      </div>
    </section>
  `,
  styles: `.big{font-size:1.4rem;font-weight:750;margin:0;color:var(--c-primary-deep)}.top-card h3{margin:0}.outcome{display:flex;gap:.5rem;align-items:center}.others{list-style:none;padding:0;display:grid;gap:.6rem}.others li{display:grid;grid-template-columns:1fr auto;gap:.25rem .75rem}.others .meter{grid-column:1/-1;display:block}.meter.thin{height:6px}.meter.thin span{background:var(--c-border-strong)}.lab-note{background:var(--c-warn-bg);color:var(--c-warn);border-radius:8px;padding:.4rem .7rem}.model{display:flex;gap:.4rem;align-items:center;margin-top:var(--space-3)}`,
})
export class AnalysisResultComponent {
  readonly analysis = input.required<Analysis>();
  protected pct(score: number): number {
    return Math.round(score * 100);
  }
  /** The model service is running a test-fixture model (no trained crop-disease model yet): say so plainly. */
  protected isTestModel(): boolean {
    return /test fixture/i.test(this.analysis().model.name ?? '');
  }
  /** Never show a "possible problem" for unreadable / off-domain photos. */
  protected showPredictions(): boolean {
    const o = this.analysis().outcome;
    return o === 'LIKELY_MATCH' || o === 'UNCERTAIN';
  }
}
