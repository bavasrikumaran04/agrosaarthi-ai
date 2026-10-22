import { Router } from 'express';
import { databaseState, pingDatabase } from '../../db/connection.js';
import { sendOk } from '../../lib/http.js';
import { route } from '../../lib/route.js';

export interface ProviderStatusSource {
  /** Non-secret, public-safe status of each provider ("gemini", "not-configured", "simulated" ...). */
  describeProviders(): Record<string, { provider: string; mode: 'live' | 'simulated' | 'disabled' }>;
}

export interface HealthRouterDeps {
  version: string;
  startedAt: Date;
  providers: ProviderStatusSource;
}

/**
 * Liveness (process is up) vs readiness (can serve traffic: database reachable).
 * Optional providers do not fail readiness — they are reported so operators
 * and the admin dashboard can see what is live, simulated or disabled.
 */
export function createHealthRouter(deps: HealthRouterDeps): Router {
  const router = Router();

  router.get(
    '/live',
    route({}, ({ res }) => {
      sendOk(res, { status: 'ok', uptimeSeconds: Math.round(process.uptime()) });
    }),
  );

  const readiness = route({}, async ({ res }) => {
    const db = await pingDatabase();
    const ready = db.ok;
    res.setHeader('Cache-Control', 'no-store');
    sendOk(
      res,
      {
        status: ready ? 'ready' : 'not_ready',
        version: deps.version,
        startedAt: deps.startedAt.toISOString(),
        checks: { database: { ok: db.ok, state: databaseState(), latencyMs: db.latencyMs } },
        providers: deps.providers.describeProviders(),
      },
      ready ? 200 : 503,
    );
  });

  router.get('/ready', readiness);
  router.get('/', readiness);
  return router;
}
