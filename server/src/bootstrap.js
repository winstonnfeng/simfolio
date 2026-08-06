import { buildContainer } from './composition/buildContainer.js';
import { runMigrations } from './infrastructure/db/runMigrations.js';
import { describeConfig } from './config/config.js';
import { createApp } from './app.js';

/**
 * Everything the process does between "config exists" and "requests are being
 * served", as one callable function.
 *
 * index.js is only a shell around this, which means an end-to-end test can boot
 * a real server on an ephemeral port against an in-memory database and shut it
 * down cleanly — the same code path production runs.
 */
export async function startServer({ config, logger = console }) {
  const container = await buildContainer({ config });
  await runMigrations({ db: container.db, driver: config.database.driver, logger });

  const app = createApp(container);
  const server = await listen(app, config.http.port);
  const { port } = server.address();

  logger.log(`[api] listening on http://localhost:${port}`);
  logger.log(`[api] ${formatDescription(config)}`);

  warmSymbolUniverse(container.useCases.refreshSymbolUniverse, logger);

  return {
    app,
    server,
    container,
    port,
    /** Idempotent: safe to call from a signal handler and from a test teardown. */
    async stop(reason = 'stop') {
      logger.log(`[api] ${reason} — shutting down`);
      await new Promise((resolve) => server.close(resolve));
      await container.close();
    },
  };
}

function listen(app, port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port);
    server.once('listening', () => resolve(server));
    server.once('error', reject);
  });
}

function formatDescription(config) {
  return Object.entries(describeConfig(config))
    .map(([key, value]) => `${key}: ${value}`)
    .join(' · ');
}

/** The searchable symbol table fills in the background; failure is not fatal. */
function warmSymbolUniverse(refreshSymbolUniverse, logger) {
  refreshSymbolUniverse
    .executeIfStale()
    .then(({ refreshed, count }) => logger.log(`[symbols] ${refreshed ? 'refreshed' : 'cached'} ${count} instruments`))
    .catch((error) => logger.warn('[symbols] refresh failed —', error.message));
}
