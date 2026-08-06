/**
 * Opens the connection the whole process shares. Both drivers are imported
 * lazily, so a Postgres deployment never loads better-sqlite3 (a native module
 * that has to compile) and a SQLite deployment never loads pg. Only the driver
 * you actually chose has to exist.
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
  const { SqliteDatabase } = await import('../infrastructure/db/SqliteDatabase.js');
  return SqliteDatabase.open({ file: config.database.file });
}
