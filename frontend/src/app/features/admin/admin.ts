import { DatePipe, KeyValuePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../core/api';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n';

interface Metrics {
  usersByRole: Record<string, number>;
  casesByStatus: Record<string, number>;
  analysesByOutcome: Record<string, number>;
  failedAnalysesLast7Days: number;
  openCallbacks: number;
  simulatedAnalyses: number;
}
interface Providers {
  configured: Record<string, { provider: string; mode: 'live' | 'simulated' | 'disabled' }>;
  checks: Record<string, { ok: boolean; detail?: string }>;
}
interface UserRow { id: string; name: string; email?: string; phoneMasked?: string; role: string; status: string; lastLoginAt?: string }
interface AuditRow { id: string; action: string; outcome: string; actorRole?: string; targetType?: string; targetId?: string; createdAt?: string }

type Tab = 'metrics' | 'users' | 'providers' | 'audit';

@Component({
  selector: 'app-admin',
  imports: [TranslatePipe, FormsModule, DatePipe, KeyValuePipe],
  template: `
    <section class="stack">
      <h1>{{ 'admin.title' | t }}</h1>
      <div class="tabs" role="tablist">
        @for (x of tabs; track x.id) {<button role="tab" type="button" [attr.aria-selected]="tab() === x.id" (click)="open(x.id)">{{ x.label | t }}</button>}
      </div>
      @if (error()) {<div class="alert alert-danger" role="alert">{{ error() }}</div>}
      @if (notice()) {<div class="alert alert-success" role="status">{{ notice() }}</div>}

      @if (tab() === 'metrics' && metrics(); as m) {
        <div class="grid">
          <div class="card"><div class="stat">{{ m.openCallbacks }}</div>{{ 'admin.openCallbacks' | t }}</div>
          <div class="card"><div class="stat">{{ m.failedAnalysesLast7Days }}</div>{{ 'admin.failed7' | t }}</div>
          <div class="card"><div class="stat">{{ m.simulatedAnalyses }}</div>{{ 'admin.simulated' | t }}</div>
        </div>
        <div class="grid">
          @for (group of [['admin.usersByRole', m.usersByRole], ['admin.casesByStatus', m.casesByStatus], ['admin.analysesByOutcome', m.analysesByOutcome]]; track $index) {
            <div class="card"><h2>{{ $any(group[0]) | t }}</h2>
              <ul>@for (kv of $any(group[1]) | keyvalue; track kv.key) {<li>{{ kv.key }}: <strong>{{ kv.value }}</strong></li>} @empty {<li>{{ 'admin.noData' | t }}</li>}</ul>
            </div>
          }
        </div>
      }

      @if (tab() === 'providers' && providers(); as p) {
        <div class="table-wrap"><table class="table">
          <thead><tr><th></th><th>Provider</th><th>{{ 'admin.status' | t }}</th></tr></thead>
          <tbody>@for (kv of p.configured | keyvalue; track kv.key) {
            <tr><td>{{ kv.key }}</td><td>{{ kv.value.provider }}</td>
              <td><span class="badge" [class.badge-ok]="kv.value.mode === 'live'" [class.badge-warn]="kv.value.mode === 'simulated'" [class.badge-danger]="kv.value.mode === 'disabled'">{{ 'admin.mode.' + kv.value.mode | t }}</span></td></tr>
          }</tbody>
        </table></div>
        <ul>@for (kv of p.checks | keyvalue; track kv.key) {<li>{{ kv.key }}: {{ (kv.value.ok ? 'admin.healthy' : 'admin.unhealthy') | t }} {{ kv.value.detail ?? '' }}</li>}</ul>
      }

      @if (tab() === 'users') {
        <form class="card stack" (ngSubmit)="createStaff()">
          <h2>{{ 'admin.createStaff' | t }}</h2>
          <label for="sn">{{ 'auth.name' | t }}</label><input id="sn" name="sn" type="text" [(ngModel)]="staff.name" required />
          <label for="se">{{ 'admin.email' | t }}</label><input id="se" name="se" type="email" [(ngModel)]="staff.email" required />
          <label for="sr">{{ 'admin.role' | t }}</label>
          <select id="sr" name="sr" [(ngModel)]="staff.role"><option value="EXPERT">EXPERT</option><option value="ADMIN">ADMIN</option></select>
          <button class="btn btn-primary" type="submit" [disabled]="!staff.name.trim() || !staff.email.trim()">{{ 'admin.create' | t }}</button>
        </form>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>{{ 'auth.name' | t }}</th><th>{{ 'admin.role' | t }}</th><th>{{ 'admin.status' | t }}</th><th></th></tr></thead>
          <tbody>@for (u of users(); track u.id) {
            <tr><td>{{ u.name }}<br /><span class="small muted">{{ u.email ?? u.phoneMasked }}</span></td><td>{{ u.role }}</td><td>{{ u.status }}</td>
              <td><button class="btn" type="button" (click)="toggle(u)">{{ (u.status === 'ACTIVE' ? 'admin.disable' : 'admin.enable') | t }}</button></td></tr>
          }</tbody>
        </table></div>
      }

      @if (tab() === 'audit') {
        <div class="table-wrap"><table class="table">
          <thead><tr><th>{{ 'admin.when' | t }}</th><th>{{ 'admin.action' | t }}</th><th>{{ 'admin.outcome' | t }}</th><th>{{ 'admin.role' | t }}</th><th></th></tr></thead>
          <tbody>@for (a of audit(); track a.id) {<tr><td class="small">{{ a.createdAt | date: 'short' }}</td><td>{{ a.action }}</td><td>{{ a.outcome }}</td><td>{{ a.actorRole ?? 'SYSTEM' }}</td><td class="small">{{ a.targetType }} {{ a.targetId }}</td></tr>}</tbody>
        </table></div>
      }
    </section>
  `,
})
export class AdminPage {
  private readonly api = inject(ApiClient);
  private readonly i18n = inject(I18nService);
  protected readonly tabs: Array<{ id: Tab; label: string }> = [
    { id: 'metrics', label: 'admin.metrics' },
    { id: 'users', label: 'admin.users' },
    { id: 'providers', label: 'admin.providers' },
    { id: 'audit', label: 'admin.audit' },
  ];
  protected readonly tab = signal<Tab>('metrics');
  protected readonly metrics = signal<Metrics | null>(null);
  protected readonly providers = signal<Providers | null>(null);
  protected readonly users = signal<UserRow[]>([]);
  protected readonly audit = signal<AuditRow[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected staff = { name: '', email: '', role: 'EXPERT' };

  constructor() {
    void this.open('metrics');
  }

  protected async open(t: Tab): Promise<void> {
    this.tab.set(t);
    this.error.set(null);
    try {
      if (t === 'metrics') this.metrics.set(await firstValueFrom(this.api.get<Metrics>('/api/v1/admin/metrics')));
      if (t === 'providers') this.providers.set(await firstValueFrom(this.api.get<Providers>('/api/v1/admin/providers')));
      if (t === 'users') this.users.set((await firstValueFrom(this.api.getPage<UserRow>('/api/v1/admin/users', { pageSize: 100 }))).items);
      if (t === 'audit') this.audit.set((await firstValueFrom(this.api.getPage<AuditRow>('/api/v1/admin/audit', { pageSize: 100 }))).items);
    } catch (e) {
      this.error.set(this.i18n.errorMessage(e));
    }
  }

  protected async createStaff(): Promise<void> {
    this.notice.set(null);
    try {
      const r = await firstValueFrom(this.api.post<{ user: UserRow; temporaryPassword?: string }>('/api/v1/admin/users', { ...this.staff, name: this.staff.name.trim(), email: this.staff.email.trim() }));
      if (r.temporaryPassword) this.notice.set(this.i18n.t('admin.tempPassword', { email: this.staff.email, password: r.temporaryPassword }));
      this.staff = { name: '', email: '', role: 'EXPERT' };
      await this.open('users');
    } catch (e) {
      this.error.set(this.i18n.errorMessage(e));
    }
  }

  protected async toggle(u: UserRow): Promise<void> {
    try {
      await firstValueFrom(this.api.patch(`/api/v1/admin/users/${u.id}`, { status: u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' }));
      await this.open('users');
    } catch (e) {
      this.error.set(this.i18n.errorMessage(e));
    }
  }
}
