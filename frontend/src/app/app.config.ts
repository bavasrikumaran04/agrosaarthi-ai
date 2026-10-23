import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { APP_CONFIG, type AppConfig } from './core/api';
import { AuthService, authInterceptor } from './core/auth';

export function buildAppConfig(config: AppConfig): ApplicationConfig {
  return {
    providers: [
      provideBrowserGlobalErrorListeners(),
      { provide: APP_CONFIG, useValue: config },
      // XHR backend (no withFetch) so upload progress events work.
      provideHttpClient(withInterceptors([authInterceptor])),
      provideRouter(routes, withComponentInputBinding()),
      provideAppInitializer(() => inject(AuthService).restoreSession()),
    ],
  };
}
