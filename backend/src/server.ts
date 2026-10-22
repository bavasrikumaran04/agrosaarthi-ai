import { existsSync } from 'node:fs';
import type { Server } from 'node:http';
import { buildApplication } from './bootstrap.js';
import { ConfigValidationError, describeConfig, loadConfig } from './config/index.js';
import { connectDatabase, disconnectDatabase } from './db/connection.js';
import { createLogger, serializeError } from './lib/logger.js';

/**
 * Process entrypoint: validate configuration, connect to MongoDB, start HTTP,
 * and shut down gracefully on SIGTERM/SIGINT (in-flight requests finish within
 * SHUTDOWN_GRACE_MS before the database connection closes).
 */
async function main(): Promise<void> {
  // Local development convenience; hosting platforms inject real environment variables.
  if (process.env.NODE_ENV !== 'production' && existsSync('.env')) process.loadEnvFile('.env');

  let config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigValidationError) {
      console.error(err.message);
      console.error('See docs/ENVIRONMENT_VARIABLES.md and backend/.env.example.');
      process.exit(1);
    }
    throw err;
  }

  const logger = createLogger({ level: config.core.logLevel, pretty: config.core.logPretty });
  logger.info({ config: describeConfig(config) }, 'starting AgroSaarthi API');

  await connectDatabase(config.database, logger);
  const { app, onShutdown } = await buildApplication(config, logger);

  const server: Server = app.listen(config.core.port, config.core.host, () => {
    logger.info({ port: config.core.port, host: config.core.host }, 'HTTP server listening');
  });
  // Slightly above typical load-balancer idle timeouts to avoid 502s on reused connections.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  server.requestTimeout = config.core.requestTimeoutMs + 5_000;

  let shuttingDown = false;
  const shutdown = async (signal: string, exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down');
    const force = setTimeout(() => {
      logger.error('graceful shutdown timed out; forcing exit');
      process.exit(1);
    }, config.core.shutdownGraceMs);
    force.unref();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    try {
      await onShutdown();
      await disconnectDatabase();
    } catch (err) {
      logger.error({ err: serializeError(err) }, 'error during shutdown');
      exitCode = 1;
    }
    logger.info('shutdown complete');
    process.exit(exitCode);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: serializeError(reason) }, 'unhandled promise rejection');
    void shutdown('unhandledRejection', 1);
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err: serializeError(err) }, 'uncaught exception');
    void shutdown('uncaughtException', 1);
  });
}

main().catch((err: unknown) => {
  console.error('Fatal startup error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
