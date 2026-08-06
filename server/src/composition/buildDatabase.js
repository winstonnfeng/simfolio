import { SqliteDatabase } from '../infrastructure/db/SqliteDatabase.js';

/**
 * Opens the connection the whole process shares. Postgres is imported lazily so
 * a SQLite-only deployment never loads the pg driver, and vice versa.
 */
export async function buildDatabase(config) {
  if (config.database.driver === 'postgres') {
    const { PostgresDatabase } = await import('../infrastructure/db/PostgresDatabase.js');
    return PostgresDatabase.open({
      url: config.database.url,
      poolMax: config.database.poolMax,
      ssl: config.database.ssl,
    });
  }
  return SqliteDatabase.open({ file: config.database.file });
}
