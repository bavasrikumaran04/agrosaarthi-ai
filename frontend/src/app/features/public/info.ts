import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/i18n';

/** Help, safety, privacy and not-found pages; content comes entirely from the dictionaries. */
@Component({
  selector: 'app-info',
  imports: [TranslatePipe, RouterLink],
  template: `
    <article class="stack narrow">
      @switch (page()) {
        @case ('help') {
          <h1>{{ 'info.helpTitle' | t }}</h1>
          <section class="card"><h2>{{ 'info.helpPhotoTitle' | t }}</h2><p>{{ 'info.helpPhoto' | t }}</p></section>
          <section class="card"><h2>{{ 'info.helpAskTitle' | t }}</h2><p>{{ 'info.helpAsk' | t }}</p></section>
          <section class="card"><h2>{{ 'info.helpExpertTitle' | t }}</h2><p>{{ 'info.helpExpert' | t }}</p></section>
          <p><a routerLink="/safety">{{ 'info.safetyTitle' | t }}</a> · <a routerLink="/privacy">{{ 'info.privacyTitle' | t }}</a></p>
        }
        @case ('safety') {
          <h1>{{ 'info.safetyTitle' | t }}</h1>
          <ul class="card list">
            <li>{{ 'info.safety1' | t }}</li><li>{{ 'info.safety2' | t }}</li><li>{{ 'info.safety3' | t }}</li><li>{{ 'info.safety4' | t }}</li>
          </ul>
        }
        @case ('privacy') {
          <h1>{{ 'info.privacyTitle' | t }}</h1>
          <div class="card stack">
            <p>{{ 'info.privacy1' | t }}</p><p>{{ 'info.privacy2' | t }}</p><p>{{ 'info.privacy3' | t }}</p>
            <p>{{ 'info.privacy4' | t }}</p><p>{{ 'info.privacy5' | t }}</p>
          </div>
          <p class="alert alert-warning">{{ 'info.privacy6' | t }}</p>
        }
        @default {
          <h1>{{ 'info.notFoundTitle' | t }}</h1>
          <p>{{ 'info.notFound' | t }}</p>
          <a class="btn" routerLink="/">{{ 'nav.home' | t }}</a>
        }
      }
    </article>
  `,
  styles: `.list li{margin-bottom:.75rem}`,
})
export class InfoPage {
  readonly page = input<'help' | 'safety' | 'privacy' | 'notfound'>('notfound');
}
