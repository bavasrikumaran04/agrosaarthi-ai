import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth';
import { TranslatePipe } from '../../core/i18n/i18n';

@Component({
  selector: 'app-home',
  imports: [RouterLink, TranslatePipe],
  template: `
    <section class="stack">
      <h1>{{ 'home.title' | t }}</h1>
      <p class="lead">{{ 'home.lead' | t }}</p>
      <div class="stack actions">
        <a class="btn btn-primary btn-big btn-block" [routerLink]="auth.isAuthenticated() ? '/analyze' : '/register'">📷 {{ 'home.ctaAnalyze' | t }}</a>
        <a class="btn btn-big btn-block" [routerLink]="auth.isAuthenticated() ? '/ask' : '/register'">💬 {{ 'home.ctaAsk' | t }}</a>
        @if (!auth.isAuthenticated()) {
          <p class="center">{{ 'auth.haveAccount' | t }} <a routerLink="/login">{{ 'nav.login' | t }}</a></p>
        }
      </div>
      <div class="card">
        <h2>{{ 'home.howTitle' | t }}</h2>
        <ol class="steps">
          <li>{{ 'home.step1' | t }}</li>
          <li>{{ 'home.step2' | t }}</li>
          <li>{{ 'home.step3' | t }}</li>
        </ol>
      </div>
      <div class="alert alert-warning">
        <h2>{{ 'home.limitsTitle' | t }}</h2>
        <p>{{ 'home.limits' | t }}</p>
      </div>
      <div class="card">
        <h2>{{ 'home.phoneTitle' | t }}</h2>
        <p>{{ 'home.phoneText' | t }}</p>
      </div>
      <p><a routerLink="/crops">{{ 'nav.crops' | t }} →</a></p>
    </section>
  `,
  styles: `.lead{font-size:1.15rem}.actions{max-width:30rem}.center{text-align:center}.steps li{margin-bottom:.5rem}`,
})
export class HomePage {
  protected readonly auth = inject(AuthService);
}
