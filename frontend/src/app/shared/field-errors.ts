import { Component, computed, inject, input } from '@angular/core';
import { type AbstractControl } from '@angular/forms';
import { I18nService } from '../core/i18n/i18n';

/** Translated validation messages for a form control, shown after it is touched. */
@Component({
  selector: 'app-field-errors',
  template: `@if (message(); as m) {<span class="error" [id]="id()" role="alert">{{ m }}</span>}`,
})
export class FieldErrors {
  private readonly i18n = inject(I18nService);
  readonly control = input.required<AbstractControl>();
  readonly id = input<string>('');
  /** Bumped by the parent on submit so untouched fields also show errors. */
  readonly tick = input<number>(0);

  readonly message = computed(() => {
    this.tick();
    const c = this.control();
    if (!c.errors || !(c.touched || c.dirty || this.tick() > 0)) return null;
    const e = c.errors;
    if (e['required']) return this.i18n.t('errors.required');
    if (e['minlength']) return this.i18n.t('errors.minlength', { min: (e['minlength'] as { requiredLength: number }).requiredLength });
    if (e['maxlength']) return this.i18n.t('errors.maxlength', { max: (e['maxlength'] as { requiredLength: number }).requiredLength });
    if (e['email']) return this.i18n.t('errors.email');
    if (e['phone']) return this.i18n.t('errors.phone');
    if (e['pattern']) return this.i18n.t('errors.pattern');
    if (typeof e['server'] === 'string') return e['server'];
    return this.i18n.t('errors.pattern');
  });
}

/** Indian mobile number with optional +91/0 prefix. */
export function phoneValidator(c: AbstractControl): Record<string, true> | null {
  const v = String(c.value ?? '').replace(/[\s-]/g, '');
  if (!v) return null;
  return /^(\+?91|0)?[6-9]\d{9}$/.test(v) ? null : { phone: true };
}
