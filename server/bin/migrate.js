import { config } from '../src/config/loadConfig.js';
import { buildDatabase } from '../src/composition/buildDatabase.js';
import { runMigrations } from '../src/infrastructure/db/runMigrations.js';

/**
 * Migrating needs a database and nothing else — no vendor keys, no market
 * providers, no HTTP layer. Because the composition root is split into focused
 * builders, this script can ask for exactly that one piece.
 */
const db = await buildDatabase(config);
try {
  await runMigrations({ db, driver: config.database.driver });
  console.log(`[migrate] ${config.database.driver} schema up to date`);
} finally {
  await db.close();
}
