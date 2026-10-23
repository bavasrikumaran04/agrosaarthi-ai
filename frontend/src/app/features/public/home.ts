import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth';
import { TranslatePipe } from '../../core/i18n/i18n';
import { Icon } from '../../shared/icon';

type Status = 'live' | 'partial' | 'planned';

/** Public landing page: problem, solution, how it works, benefits, architecture and an honest prototype status. */
@Component({
  selector: 'app-home',
  imports: [RouterLink, TranslatePipe, Icon],
  template: `
    <section class="hero">
      <div class="hero-copy stack">
        <span class="eyebrow"><app-icon name="sprout" [size]="18" /> {{ 'home.eyebrow' | t }}</span>
        <h1>{{ 'home.title' | t }}</h1>
        <p class="lead">{{ 'home.lead' | t }}</p>
        <div class="hero-actions">
          <a class="btn btn-primary btn-big" [routerLink]="auth.isAuthenticated() ? '/analyze' : '/register'"><app-icon name="camera" /> {{ 'home.ctaAnalyze' | t }}</a>
          <a class="btn btn-big" [routerLink]="auth.isAuthenticated() ? '/ask' : '/register'"><app-icon name="chat" /> {{ 'home.ctaAsk' | t }}</a>
        </div>
        @if (!auth.isAuthenticated()) {
          <p class="small">{{ 'auth.haveAccount' | t }} <a routerLink="/login">{{ 'nav.login' | t }}</a> · <a routerLink="/phone-demo">{{ 'home.tryPhone' | t }}</a></p>
        }
        <ul class="trust small">
          <li><app-icon name="globe" [size]="18" /> {{ 'home.trustLanguage' | t }}</li>
          <li><app-icon name="expert" [size]="18" /> {{ 'home.trustExpert' | t }}</li>
          <li><app-icon name="lock" [size]="18" /> {{ 'home.trustPrivacy' | t }}</li>
        </ul>
      </div>
      <div class="hero-art" aria-hidden="true">
        <svg viewBox="0 0 420 380" class="art">
          <defs>
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3f1e5"/><stop offset="1" stop-color="#f6f9f3"/></linearGradient>
            <linearGradient id="leafg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4caf63"/><stop offset="1" stop-color="#1e7a3a"/></linearGradient>
          </defs>
          <rect x="0" y="0" width="420" height="380" rx="28" fill="url(#sky)"/>
          <circle cx="345" cy="70" r="34" fill="#f6d98b" opacity=".75"/>
          <path d="M0 290 C90 250 180 300 270 270 S400 250 420 262 V380 H0Z" fill="#cfe6d3"/>
          <path d="M0 320 C110 290 210 335 300 308 S410 296 420 300 V380 H0Z" fill="#b5d9bc"/>
          @for (x of rows; track x) {<path [attr.d]="'M' + x + ' 380 L' + (x + 24) + ' 300'" stroke="#93c49d" stroke-width="3" stroke-linecap="round"/>}
          <!-- phone -->
          <rect x="120" y="38" width="170" height="300" rx="26" fill="#17201a"/>
          <rect x="130" y="56" width="150" height="266" rx="16" fill="#fff"/>
          <rect x="182" y="45" width="46" height="5" rx="2.5" fill="#3a463d"/>
          <rect x="142" y="70" width="126" height="118" rx="12" fill="#eef3ea"/>
          <path d="M205 176c-3-26 4-52 36-78-34 2-56 20-60 50-6-12-16-18-30-18 4 24 22 40 54 46z" fill="url(#leafg)"/>
          <path d="M205 176c4-22 12-40 30-62" stroke="#d7f0dc" stroke-width="2" fill="none"/>
          <circle cx="222" cy="128" r="6" fill="#a0672e" opacity=".85"/><circle cx="196" cy="150" r="4.5" fill="#a0672e" opacity=".8"/>
          <path d="M150 82v-6h10M260 82v-6h-10M150 176v6h10M260 176v6h-10" stroke="#1e7a3a" stroke-width="3" fill="none" stroke-linecap="round"/>
          <rect x="142" y="200" width="126" height="14" rx="7" fill="#e3f1e5"/><rect x="142" y="200" width="78" height="14" rx="7" fill="#1e7a3a"/>
          <rect x="142" y="224" width="100" height="9" rx="4.5" fill="#d5ddd0"/><rect x="142" y="240" width="80" height="9" rx="4.5" fill="#d5ddd0"/>
          <rect x="142" y="272" width="126" height="34" rx="10" fill="#1e7a3a"/>
          <text x="205" y="294" text-anchor="middle" font-size="13" font-weight="700" fill="#fff" font-family="Nirmala UI, Segoe UI, sans-serif">தமிழ் · English</text>
          <!-- chips -->
          <g transform="translate(18 92)"><rect width="112" height="44" rx="14" fill="#fff" stroke="#d5ddd0"/><circle cx="22" cy="22" r="12" fill="#e3f1e5"/><path d="M17 22l4 4 7-8" stroke="#1e7a3a" stroke-width="2.5" fill="none" stroke-linecap="round"/><rect x="42" y="15" width="56" height="6" rx="3" fill="#b7c4b0"/><rect x="42" y="25" width="38" height="6" rx="3" fill="#d5ddd0"/></g>
          <g transform="translate(296 168)"><rect width="110" height="44" rx="14" fill="#fff" stroke="#d5ddd0"/><circle cx="22" cy="22" r="12" fill="#fbf1df"/><path d="M17 18c0 6 4 10 10 10l2-2-3-2-1 1c-2-1-4-3-5-5l1-1-2-3z" fill="#7a5230"/><rect x="42" y="15" width="54" height="6" rx="3" fill="#b7c4b0"/><rect x="42" y="25" width="34" height="6" rx="3" fill="#d5ddd0"/></g>
          <g transform="translate(34 236)"><rect width="104" height="44" rx="14" fill="#fff" stroke="#d5ddd0"/><circle cx="22" cy="22" r="12" fill="#e6f2fa"/><circle cx="22" cy="19" r="4" fill="#0b5c8a"/><path d="M14 30c1-4 4-6 8-6s7 2 8 6" fill="#0b5c8a"/><rect x="42" y="15" width="48" height="6" rx="3" fill="#b7c4b0"/><rect x="42" y="25" width="30" height="6" rx="3" fill="#d5ddd0"/></g>
        </svg>
      </div>
    </section>

    <section class="band" aria-labelledby="problem-h">
      <span class="eyebrow">{{ 'home.problemEyebrow' | t }}</span>
      <h2 id="problem-h">{{ 'home.problemTitle' | t }}</h2>
      <div class="grid three">
        @for (p of problems; track p.key) {
          <div class="card">
            <span class="icon-chip accent"><app-icon [name]="p.icon" /></span>
            <h3>{{ 'home.' + p.key + 'Title' | t }}</h3>
            <p class="muted">{{ 'home.' + p.key | t }}</p>
          </div>
        }
      </div>
    </section>

    <section class="band" aria-labelledby="solution-h">
      <span class="eyebrow">{{ 'home.solutionEyebrow' | t }}</span>
      <h2 id="solution-h">{{ 'home.solutionTitle' | t }}</h2>
      <p class="lead">{{ 'home.solutionLead' | t }}</p>
      <div class="grid two-up">
        @for (f of features; track f.key) {
          <div class="card feature">
            <div class="card-head">
              <span class="icon-chip lg"><app-icon [name]="f.icon" [size]="28" /></span>
              <h3>{{ 'home.' + f.key + 'Title' | t }}</h3>
            </div>
            <p class="muted">{{ 'home.' + f.key | t }}</p>
            <span class="proto" [class]="'proto ' + f.status">{{ 'home.status.' + f.status | t }}</span>
            <p class="small status-note">{{ 'home.' + f.key + 'Status' | t }}</p>
          </div>
        }
      </div>
    </section>

    <section class="band how" aria-labelledby="how-h">
      <h2 id="how-h">{{ 'home.howTitle' | t }}</h2>
      <ol class="steps">
        @for (s of steps; track s; let i = $index) {
          <li><span class="num" aria-hidden="true">{{ i + 1 }}</span><span>{{ 'home.' + s | t }}</span></li>
        }
      </ol>
    </section>

    <section class="band" aria-labelledby="benefits-h">
      <span class="eyebrow">{{ 'home.benefitsEyebrow' | t }}</span>
      <h2 id="benefits-h">{{ 'home.benefitsTitle' | t }}</h2>
      <div class="grid four">
        @for (b of benefits; track b.key) {
          <div class="benefit">
            <span class="icon-chip"><app-icon [name]="b.icon" /></span>
            <h3>{{ 'home.' + b.key + 'Title' | t }}</h3>
            <p class="muted small">{{ 'home.' + b.key | t }}</p>
          </div>
        }
      </div>
    </section>

    <section class="band" aria-labelledby="tech-h">
      <span class="eyebrow">{{ 'home.techEyebrow' | t }}</span>
      <h2 id="tech-h">{{ 'home.techTitle' | t }}</h2>
      <div class="arch">
        @for (n of tech; track n.key; let last = $last) {
          <div class="arch-node">
            <span class="icon-chip info"><app-icon [name]="n.icon" /></span>
            <strong>{{ 'home.tech.' + n.key | t }}</strong>
            <span class="small muted">{{ n.stack }}</span>
            <span class="proto" [class]="'proto ' + n.status">{{ 'home.status.' + n.status | t }}</span>
          </div>
        }
      </div>
    </section>

    <section class="alert alert-warning limits">
      <h2>{{ 'home.limitsTitle' | t }}</h2>
      <p>{{ 'home.limits' | t }}</p>
    </section>

    <section class="cta">
      <div>
        <h2>{{ 'home.ctaTitle' | t }}</h2>
        <p>{{ 'home.ctaText' | t }}</p>
      </div>
      <div class="cluster">
        @if (auth.isAuthenticated()) {
          <a class="btn btn-big cta-btn" [routerLink]="auth.homeFor(auth.user()!)">{{ 'home.ctaContinue' | t }} <app-icon name="arrow" /></a>
        } @else {
          <a class="btn btn-big cta-btn" routerLink="/register">{{ 'home.ctaRegister' | t }} <app-icon name="arrow" /></a>
          <a class="btn btn-big btn-ghost-light" routerLink="/crops">{{ 'nav.crops' | t }}</a>
        }
      </div>
    </section>
  `,
  styles: `
    :host { display: block; }
    .hero { display: grid; gap: var(--space-6); align-items: center; padding: var(--space-4) 0 var(--space-6); }
    @media (min-width: 900px) { .hero { grid-template-columns: 1.1fr 0.9fr; padding-top: var(--space-6); } }
    .hero h1 { font-size: clamp(2rem, 1.4rem + 2.4vw, 3rem); line-height: 1.15; }
    .hero-actions { display: flex; flex-wrap: wrap; gap: var(--space-3); }
    @media (max-width: 560px) { .hero-actions .btn { width: 100%; } }
    .trust { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); color: var(--c-muted); }
    .trust li { display: inline-flex; align-items: center; gap: var(--space-2); }
    .trust app-icon { color: var(--c-primary); }
    .art { width: 100%; max-width: 30rem; display: block; margin: 0 auto; filter: drop-shadow(0 12px 28px rgb(16 40 22 / 0.12)); }
    .band { padding: var(--space-6) 0; border-top: 1px solid var(--c-border); }
    .band > h2 { font-size: clamp(1.4rem, 1.1rem + 1vw, 1.9rem); max-width: 40rem; }
    .grid.three { grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr)); margin-top: var(--space-4); }
    .grid.two-up { grid-template-columns: 1fr; margin-top: var(--space-4); }
    @media (min-width: 760px) { .grid.two-up { grid-template-columns: 1fr 1fr; } }
    .grid.four { grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr)); margin-top: var(--space-4); gap: var(--space-5); }
    .card h3 { margin-top: var(--space-3); }
    .feature .card-head h3 { margin: 0; }
    .status-note { color: var(--c-muted); margin: var(--space-2) 0 0; }
    .steps { list-style: none; padding: 0; margin: var(--space-4) 0 0; display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr)); counter-reset: none; }
    .steps li { display: flex; gap: var(--space-3); align-items: flex-start; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--radius-lg); padding: var(--space-4); box-shadow: var(--shadow-sm); }
    .num { display: inline-grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: var(--c-primary); color: #fff; font-weight: 800; flex: none; }
    .benefit h3 { margin: var(--space-3) 0 var(--space-2); }
    .arch { display: grid; gap: var(--space-3); grid-template-columns: repeat(auto-fit, minmax(min(100%, 10.5rem), 1fr)); margin-top: var(--space-4); }
    .arch-node { display: flex; flex-direction: column; gap: var(--space-2); align-items: flex-start; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--radius-lg); padding: var(--space-4); }
    .limits { margin: var(--space-4) 0 var(--space-6); }
    .cta { display: flex; flex-wrap: wrap; gap: var(--space-5); align-items: center; justify-content: space-between; padding: var(--space-6); border-radius: 24px; color: #fff; background: radial-gradient(circle at 85% 20%, #2f9a50 0, transparent 45%), linear-gradient(135deg, var(--c-primary-dark), var(--c-primary-deep)); }
    .cta h2 { color: #fff; }
    .cta p { color: #d4e6d8; margin: 0; max-width: 34rem; }
    .cta-btn { background: #fff; border-color: #fff; color: var(--c-primary-deep); }
    .cta-btn:hover { background: #e3f1e5; border-color: #e3f1e5; }
  `,
})
export class HomePage {
  protected readonly auth = inject(AuthService);
  protected readonly rows = [-40, 20, 80, 140, 200, 260, 320, 380];
  protected readonly problems = [
    { key: 'problem1', icon: 'clock' },
    { key: 'problem2', icon: 'globe' },
    { key: 'problem3', icon: 'wifiOff' },
  ];
  protected readonly features: Array<{ key: string; icon: string; status: Status }> = [
    { key: 'featPhoto', icon: 'camera', status: 'partial' },
    { key: 'featVoice', icon: 'mic', status: 'partial' },
    { key: 'featPhone', icon: 'phone', status: 'planned' },
    { key: 'featExpert', icon: 'expert', status: 'live' },
  ];
  protected readonly steps = ['step1', 'step2', 'step3', 'step4'];
  protected readonly benefits = [
    { key: 'benefit1', icon: 'users' },
    { key: 'benefit2', icon: 'chart' },
    { key: 'benefit3', icon: 'lock' },
    { key: 'benefit4', icon: 'shield' },
  ];
  protected readonly tech: Array<{ key: string; icon: string; stack: string; status: Status }> = [
    { key: 'web', icon: 'globe', stack: 'Angular 21', status: 'live' },
    { key: 'api', icon: 'settings', stack: 'Node.js · Express', status: 'live' },
    { key: 'db', icon: 'database', stack: 'MongoDB', status: 'live' },
    { key: 'model', icon: 'cpu', stack: 'Python · FastAPI · ONNX', status: 'partial' },
    { key: 'ai', icon: 'chat', stack: 'Google Gemini', status: 'planned' },
    { key: 'phone', icon: 'keypad', stack: 'IVR / telephony', status: 'planned' },
  ];
}
