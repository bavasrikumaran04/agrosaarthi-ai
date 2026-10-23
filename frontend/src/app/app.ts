import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from './core/auth';
import { I18nService, TranslatePipe, UI_LANGUAGES, type UiLanguage } from './core/i18n/i18n';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  protected readonly languages = UI_LANGUAGES;
  protected readonly menuOpen = signal(false);
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');

  protected readonly links = computed(() => {
    const role = this.auth.role();
    const items: Array<{ path: string; label: string }> = [];
    if (role === 'FARMER') {
      items.push({ path: '/dashboard', label: 'nav.dashboard' }, { path: '/analyze', label: 'nav.analyze' }, { path: '/ask', label: 'nav.ask' }, { path: '/cases', label: 'nav.cases' });
    }
    if (role === 'EXPERT' || role === 'ADMIN') items.push({ path: '/expert', label: 'nav.expert' });
    if (role === 'ADMIN') items.push({ path: '/admin', label: 'nav.admin' });
    items.push({ path: '/crops', label: 'nav.crops' }, { path: '/help', label: 'nav.help' });
    return items;
  });

  constructor() {
    // Accessibility: after navigation move focus to the page heading (or main) so screen readers announce the new page.
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.menuOpen.set(false);
      queueMicrotask(() => setTimeout(() => {
        const h1 = this.main().nativeElement.querySelector('h1');
        const target = (h1 ?? this.main().nativeElement) as HTMLElement;
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: false });
      }));
    });
  }

  protected setLanguage(code: UiLanguage): void {
    this.i18n.setLanguage(code);
    void this.auth.updateLanguage(code).catch(() => undefined);
  }

  protected logout(): void {
    void this.auth.logout();
  }
}
