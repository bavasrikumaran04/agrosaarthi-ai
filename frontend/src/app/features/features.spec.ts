import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { APP_CONFIG } from '../core/api';
import { I18nService } from '../core/i18n/i18n';
import type { Analysis } from '../core/models';
import { AnalysisResultComponent } from './farmer/analysis-result';
import { LoginPage, RegisterPage } from './public/auth-pages';

const providers = [
  { provide: APP_CONFIG, useValue: { apiBaseUrl: '', environmentName: 'test' } },
  provideHttpClient(),
  provideHttpClientTesting(),
  provideRouter([]),
];

const base: Analysis = {
  id: 'a1',
  caseId: 'c1',
  caseNumber: 'AGS-2026-000001',
  status: 'COMPLETED',
  outcome: 'LIKELY_MATCH',
  simulated: false,
  model: { name: 'leaf-model', version: '1' },
  predictions: [
    { classKey: 'Tomato___Early_blight', label: 'Tomato early blight', score: 0.873 },
    { classKey: 'Tomato___Target_Spot', label: 'Tomato target spot', score: 0.08 },
  ],
  qualityIssues: [],
  outOfDomain: false,
  escalationRecommended: false,
  imageFileId: 'f1',
};

describe('features', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
    TestBed.configureTestingModule({ providers });
    TestBed.inject(I18nService).setLanguage('en');
  });

  function renderResult(a: Analysis): HTMLElement {
    const f = TestBed.createComponent(AnalysisResultComponent);
    f.componentRef.setInput('analysis', a);
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  }

  it('shows a possible problem with the model estimate and the "not a diagnosis" note', () => {
    const el = renderResult(base);
    expect(el.textContent).toContain('Tomato early blight');
    expect(el.textContent).toContain('87%');
    expect(el.textContent).toContain('not a confirmed diagnosis');
    const meter = el.querySelector('[role="meter"]');
    expect(meter?.getAttribute('aria-valuenow')).toBe('87');
    expect(el.querySelector('#' + meter!.getAttribute('aria-labelledby'))?.textContent).toContain('87%');
  });

  it('says plainly when the model service runs the test-fixture model', () => {
    const el = renderResult({ ...base, model: { ...base.model, name: 'TEST FIXTURE - not a crop model' } });
    expect(el.textContent).toContain('does not recognise crop diseases yet');
    expect(renderResult(base).textContent).not.toContain('does not recognise crop diseases yet');
  });

  it('never shows a disease for poor-quality or off-domain photos and explains why', () => {
    const el = renderResult({ ...base, outcome: 'POOR_QUALITY', qualityIssues: ['BLURRY'], escalationRecommended: true });
    expect(el.textContent).not.toContain('Tomato early blight');
    expect(el.textContent).toContain('The photo is blurry.');
    expect(el.textContent).toContain('We recommend that an agricultural expert');
  });

  it('labels simulated results prominently', () => {
    const el = renderResult({ ...base, simulated: true });
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('simulator');
  });

  it('marks unreviewed sources', () => {
    const el = renderResult({ ...base, guidance: { text: 'Remove affected leaves.', sources: [{ title: 'Doc', sourceOrganization: 'Org', trustStatus: 'UNREVIEWED_SOURCE_SUMMARY' }], simulated: false, kind: 'GUIDANCE' } });
    expect(el.textContent).toContain('Not yet reviewed by an expert');
  });

  it('login shows validation messages and does not call the API for an empty form', async () => {
    const f = TestBed.createComponent(LoginPage);
    f.detectChanges();
    (f.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    f.detectChanges();
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('This is required.');
    TestBed.inject(HttpTestingController).expectNone('/api/v1/auth/login');
  });

  it('registration requires both consents and a valid mobile number', async () => {
    const f = TestBed.createComponent(RegisterPage);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const set = (id: string, v: string) => {
      const input = el.querySelector(`#${id}`) as HTMLInputElement;
      input.value = v;
      input.dispatchEvent(new Event('input'));
    };
    set('name', 'Kavitha');
    set('phone', '12345');
    set('password', 'banana-field-77');
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    f.detectChanges();
    await f.whenStable();
    expect(el.textContent).toContain('Enter a valid 10-digit mobile number.');
    expect(el.querySelectorAll('[role="alert"]').length).toBeGreaterThanOrEqual(3);
    TestBed.inject(HttpTestingController).expectNone('/api/v1/auth/register');
    // Every input has a label.
    for (const input of Array.from(el.querySelectorAll('input:not([type=checkbox]), select'))) {
      expect(el.querySelector(`label[for="${input.id}"]`)).not.toBeNull();
    }
  });
});
