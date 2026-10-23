import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { buildAppConfig } from './app/app.config';
import { loadAppConfig } from './app/core/api';

loadAppConfig()
  .then((cfg) => bootstrapApplication(App, buildAppConfig(cfg)))
  .catch((err) => console.error(err));
