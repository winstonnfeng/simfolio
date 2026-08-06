import { toInstrument } from './rowMappers.js';

const REFRESHED_AT = 'symbols_refreshed_at';

/**
 * The tradable universe, cached locally. Searching hits SQLite rather than the
 * vendor, so typing in the search box costs no API quota.
 *
 * @implements {import('../../domain/ports.js').SymbolRepository}
 */
export class SqliteSymbolRepository {
  constructor({ db, clock }) {
    this.db = db;
    this.clock = clock;
  }

  async count() {
    return this.db.prepare('SELECT COUNT(*) AS n FROM symbols').get().n;
  }

  async lastRefreshedAt() {
    const row = this.db.prepare('SELECT value FROM app_meta WHERE key = ?').get(REFRESHED_AT);
    return Number(row?.value ?? 0);
  }

  async replaceAll(instruments) {
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM symbols').run();
      const insert = this.db.prepare(
        'INSERT OR IGNORE INTO symbols (symbol, name, kind, exchange) VALUES (?, ?, ?, ?)'
      );
      for (const instrument of instruments) {
        insert.run(instrument.symbol, instrument.name, instrument.kind, instrument.exchange ?? null);
      }
      this.db
        .prepare(
          'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
        )
        .run(REFRESHED_AT, String(this.clock.now()));
    });
    return instruments.length;
  }

  async has(symbol) {
    return !!this.db.prepare('SELECT 1 FROM symbols WHERE symbol = ?').get(symbol);
  }

  async findMany(symbols) {
    if (symbols.length === 0) return [];
    const placeholders = symbols.map(() => '?').join(',');
    return this.db
      .prepare(`SELECT * FROM symbols WHERE symbol IN (${placeholders})`)
      .all(...symbols)
      .map(toInstrument);
  }

  /** Exact ticker first, then prefix matches, then name matches. */
  async search(query, limit = 12) {
    const term = query.toUpperCase();
    return this.db
      .prepare(
        `SELECT * FROM symbols
         WHERE symbol = ? OR symbol LIKE ? OR name LIKE ?
         ORDER BY CASE WHEN symbol = ? THEN 0 WHEN symbol LIKE ? THEN 1 ELSE 2 END,
                  LENGTH(symbol), symbol
         LIMIT ?`
      )
      .all(term, `${term}%`, `%${query}%`, term, `${term}%`, limit)
      .map(toInstrument);
  }
}
