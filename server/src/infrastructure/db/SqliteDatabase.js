import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

/**
 * Owns the better-sqlite3 handle. Created once by the composition root and
 * injected into repositories — there is no module-level singleton to reach for,
 * so a test can hand every repository an in-memory database instead.
 */
export class SqliteDatabase {
  static open({ file }) {
    const resolved = file === ':memory:' ? file : path.resolve(file);
    if (resolved !== ':memory:') fs.mkdirSync(path.dirname(resolved), { recursive: true });
    const handle = new Database(resolved);
    handle.pragma('journal_mode = WAL');
    handle.pragma('foreign_keys = ON');
    return new SqliteDatabase(handle);
  }

  constructor(handle) {
    this.handle = handle;
  }

  prepare(sql) {
    return this.handle.prepare(sql);
  }

  exec(sql) {
    return this.handle.exec(sql);
  }

  /** Runs `work` inside a SQLite transaction. Synchronous, by driver design. */
  transaction(work) {
    return this.handle.transaction(work)();
  }

  async close() {
    this.handle.close();
  }
}
