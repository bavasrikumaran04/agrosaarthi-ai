import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth';
import { I18nService, TranslatePipe, UI_LANGUAGES, type UiLanguage } from '../../core/i18n/i18n';

@Component({
  selector: 'app-language',
  imports: [TranslatePipe],
  template: `
    <section class="stack narrow">
      <h1>{{ 'language.title' | t }}</h1>
      <fieldset class="choice-list" style="border:0;padding:0;margin:0">
        <legend class="visually-hidden">{{ 'language.title' | t }}</legend>
        @for (l of languages; track l.code) {
          <label class="choice" [attr.lang]="l.code">
            <input type="radio" name="lang" [value]="l.code" [checked]="selected() === l.code" (change)="selected.set(l.code)" />
            {{ l.nativeName }}
          </label>
        }
      </fieldset>
      <p class="muted">{{ 'language.hint' | t }}</p>
      <button type="button" class="btn btn-primary btn-big btn-block" (click)="confirm()">{{ 'language.confirm' | t }}</button>
    </section>
  `,
})
export class LanguagePage {
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly languages = UI_LANGUAGES;
  protected readonly selected = signal<UiLanguage>(this.i18n.language());

  protected confirm(): void {
    this.i18n.setLanguage(this.selected());
    void this.auth.updateLanguage(this.selected()).catch(() => undefined);
    void this.router.navigateByUrl(this.auth.isAuthenticated() ? this.auth.homeFor() : '/');
  }
}
