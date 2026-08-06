import { SQLITE_MIGRATIONS } from './migrations/sqlite.js';
import { POSTGRES_MIGRATIONS } from './migrations/postgres.js';

/**
 * One migration runner per driver, both taking the database as an argument.
 * Nothing here opens a connection or reads the environment — the caller owns
 * both, which is what makes migrating a test database a one-liner.
 */

function migrateSqlite(db, logger) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)');
  const applied = new Set(db.prepare('SELECT id FROM schema_migrations').all().map((row) => row.id));

  for (const migration of SQLITE_MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    db.transaction(() => {
      db.exec(migration.up);
      db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)').run(migration.id, Date.now());
    });
    logger.log('[migrate] applied ' + migration.id);
  }
}

async function migratePostgres(db, logger) {
  await db.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())'
  );
  const { rows } = await db.query('SELECT id FROM schema_migrations');
  const applied = new Set(rows.map((row) => row.id));

  for (const migration of POSTGRES_MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    await db.transaction(async (client) => {
      await client.query(migration.up);
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [migration.id]);
    });
    logger.log('[migrate] applied ' + migration.id);
  }
}

export async function runMigrations({ db, driver, logger = console }) {
  if (driver === 'postgres') return migratePostgres(db, logger);
  return migrateSqlite(db, logger);
}
