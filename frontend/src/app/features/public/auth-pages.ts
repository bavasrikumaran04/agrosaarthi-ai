import { Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiError } from '../../core/api';
import { AuthService } from '../../core/auth';
import { I18nService, TranslatePipe, UI_LANGUAGES } from '../../core/i18n/i18n';
import { FieldErrors, phoneValidator } from '../../shared/field-errors';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, FieldErrors],
  template: `
    <section class="stack narrow">
      <h1>{{ 'auth.loginTitle' | t }}</h1>
      @if (error()) {<div class="alert alert-danger" role="alert">{{ error() }}</div>}
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="stack">
        <div class="field">
          <label for="identifier">{{ 'auth.identifier' | t }}</label>
          <span class="hint" id="identifier-hint">{{ 'auth.identifierHint' | t }}</span>
          <input id="identifier" type="text" inputmode="email" autocomplete="username" formControlName="identifier"
                 [attr.aria-invalid]="form.controls.identifier.invalid && tick() > 0" aria-describedby="identifier-hint identifier-err" />
          <app-field-errors [control]="form.controls.identifier" id="identifier-err" [tick]="tick()" />
        </div>
        <div class="field">
          <label for="password">{{ 'auth.password' | t }}</label>
          <input id="password" type="password" autocomplete="current-password" formControlName="password"
                 [attr.aria-invalid]="form.controls.password.invalid && tick() > 0" aria-describedby="password-err" />
          <app-field-errors [control]="form.controls.password" id="password-err" [tick]="tick()" />
        </div>
        <button class="btn btn-primary btn-big btn-block" type="submit" [disabled]="busy()">
          @if (busy()) {<span class="spinner" aria-hidden="true"></span>} {{ 'auth.loginButton' | t }}
        </button>
      </form>
      <p>{{ 'auth.noAccount' | t }} <a routerLink="/register">{{ 'nav.register' | t }}</a></p>
    </section>
  `,
})
export class LoginPage {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  readonly returnUrl = input<string>();
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly tick = signal(0);
  protected readonly form = this.fb.group({
    identifier: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required]],
  });

  protected async submit(): Promise<void> {
    this.tick.update((n) => n + 1);
    this.error.set(null);
    if (this.form.invalid) return;
    this.busy.set(true);
    try {
      const v = this.form.getRawValue();
      const user = await this.auth.login(v.identifier.trim(), v.password);
      if (user.preferredLanguage === 'ta' || user.preferredLanguage === 'en') this.i18n.setLanguage(user.preferredLanguage);
      const target = this.returnUrl() && this.returnUrl()!.startsWith('/') && !user.mustChangePassword ? this.returnUrl()! : this.auth.homeFor(user);
      await this.router.navigateByUrl(target);
    } catch (err) {
      this.error.set(err instanceof ApiError && err.code === 'UNAUTHENTICATED' ? this.i18n.t('errors.INVALID_CREDENTIALS') : this.i18n.errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, FieldErrors],
  template: `
    <section class="stack narrow">
      <h1>{{ 'auth.registerTitle' | t }}</h1>
      @if (error()) {<div class="alert alert-danger" role="alert">{{ error() }}</div>}
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="stack">
        <div class="field">
          <label for="name">{{ 'auth.name' | t }}</label>
          <input id="name" type="text" autocomplete="name" formControlName="name" [attr.aria-invalid]="form.controls.name.invalid && tick() > 0" aria-describedby="name-err" />
          <app-field-errors [control]="form.controls.name" id="name-err" [tick]="tick()" />
        </div>
        <div class="field">
          <label for="phone">{{ 'auth.phone' | t }}</label>
          <span class="hint" id="phone-hint">{{ 'auth.phoneHint' | t }}</span>
          <input id="phone" type="tel" inputmode="tel" autocomplete="tel" formControlName="phone" [attr.aria-invalid]="form.controls.phone.invalid && tick() > 0" aria-describedby="phone-hint phone-err" />
          <app-field-errors [control]="form.controls.phone" id="phone-err" [tick]="tick()" />
        </div>
        <div class="field">
          <label for="password">{{ 'auth.password' | t }}</label>
          <span class="hint" id="pw-hint">{{ 'auth.passwordHint' | t }}</span>
          <input id="password" type="password" autocomplete="new-password" formControlName="password" [attr.aria-invalid]="form.controls.password.invalid && tick() > 0" aria-describedby="pw-hint pw-err" />
          <app-field-errors [control]="form.controls.password" id="pw-err" [tick]="tick()" />
        </div>
        <div class="field">
          <label for="lang">{{ 'auth.preferredLanguage' | t }}</label>
          <select id="lang" formControlName="preferredLanguage">
            @for (l of languages; track l.code) {<option [value]="l.code">{{ l.nativeName }}</option>}
          </select>
        </div>
        <div class="field">
          <label for="district">{{ 'auth.district' | t }}</label>
          <input id="district" type="text" formControlName="district" autocomplete="address-level2" />
        </div>
        <label class="check"><input type="checkbox" formControlName="acceptPrivacy" aria-describedby="privacy-err" /> <span>{{ 'auth.consentPrivacy' | t }} <a routerLink="/privacy" target="_blank">{{ 'auth.readPrivacy' | t }}</a></span></label>
        <app-field-errors [control]="form.controls.acceptPrivacy" id="privacy-err" [tick]="tick()" />
        <label class="check"><input type="checkbox" formControlName="aiConsent" aria-describedby="ai-err" /> <span>{{ 'auth.consentAi' | t }}</span></label>
        <app-field-errors [control]="form.controls.aiConsent" id="ai-err" [tick]="tick()" />
        <button class="btn btn-primary btn-big btn-block" type="submit" [disabled]="busy()">
          @if (busy()) {<span class="spinner" aria-hidden="true"></span>} {{ 'auth.registerButton' | t }}
        </button>
      </form>
      <p>{{ 'auth.haveAccount' | t }} <a routerLink="/login">{{ 'nav.login' | t }}</a></p>
    </section>
  `,
})
export class RegisterPage {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  protected readonly languages = UI_LANGUAGES;
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly tick = signal(0);
  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    phone: ['', [Validators.required, phoneValidator]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
    preferredLanguage: [this.i18n.language() as string],
    district: [''],
    acceptPrivacy: [false, Validators.requiredTrue],
    aiConsent: [false, Validators.requiredTrue],
  });

  protected async submit(): Promise<void> {
    this.tick.update((n) => n + 1);
    this.error.set(null);
    if (this.form.invalid) return;
    this.busy.set(true);
    try {
      const v = this.form.getRawValue();
      await this.auth.register({ name: v.name.trim(), phone: v.phone.trim(), password: v.password, preferredLanguage: v.preferredLanguage, district: v.district.trim() || undefined });
      if (v.preferredLanguage === 'ta' || v.preferredLanguage === 'en') this.i18n.setLanguage(v.preferredLanguage);
      await this.router.navigateByUrl('/dashboard');
    } catch (err) {
      this.error.set(this.i18n.errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}

@Component({
  selector: 'app-change-password',
  imports: [ReactiveFormsModule, TranslatePipe, FieldErrors],
  template: `
    <section class="stack narrow">
      <h1>{{ 'auth.changePasswordTitle' | t }}</h1>
      @if (auth.user()?.mustChangePassword) {<div class="alert alert-warning">{{ 'auth.mustChange' | t }}</div>}
      @if (done()) {<div class="alert alert-success" role="status">{{ 'auth.passwordChanged' | t }}</div>}
      @if (error()) {<div class="alert alert-danger" role="alert">{{ error() }}</div>}
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="stack">
        <div class="field">
          <label for="cur">{{ 'auth.currentPassword' | t }}</label>
          <input id="cur" type="password" autocomplete="current-password" formControlName="currentPassword" />
          <app-field-errors [control]="form.controls.currentPassword" [tick]="tick()" />
        </div>
        <div class="field">
          <label for="new">{{ 'auth.newPassword' | t }}</label>
          <span class="hint">{{ 'auth.passwordHint' | t }}</span>
          <input id="new" type="password" autocomplete="new-password" formControlName="newPassword" />
          <app-field-errors [control]="form.controls.newPassword" [tick]="tick()" />
        </div>
        <button class="btn btn-primary btn-block" type="submit" [disabled]="busy()">{{ 'auth.changePasswordButton' | t }}</button>
      </form>
    </section>
  `,
})
export class ChangePasswordPage {
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly tick = signal(0);
  protected readonly form = this.fb.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
  });

  protected async submit(): Promise<void> {
    this.tick.update((n) => n + 1);
    this.error.set(null);
    if (this.form.invalid) return;
    this.busy.set(true);
    try {
      const v = this.form.getRawValue();
      await this.auth.changePassword(v.currentPassword, v.newPassword);
      this.done.set(true);
      this.form.reset();
      await this.router.navigateByUrl(this.auth.homeFor());
    } catch (err) {
      this.error.set(this.i18n.errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}
