import { toInstrument } from './rowMappers.js';

const REFRESHED_AT = 'symbols_refreshed_at';
const BATCH_SIZE = 500;

/**
 * Symbol universe in Postgres. Bulk load uses multi-row inserts in batches;
 * search uses a prefix index plus a trigram index on name.
 *
 * @implements {import('../../domain/ports.js').SymbolRepository}
 */
export class PgSymbolRepository {
  constructor({ db, clock }) {
    this.db = db;
    this.clock = clock;
  }

  async count() {
    const { rows } = await this.db.query('SELECT COUNT(*)::int AS n FROM symbols');
    return rows[0].n;
  }

  async lastRefreshedAt() {
    const { rows } = await this.db.query('SELECT value FROM app_meta WHERE key = $1', [REFRESHED_AT]);
    return Number(rows[0]?.value ?? 0);
  }

  async replaceAll(instruments) {
    await this.db.transaction(async (client) => {
      await client.query('DELETE FROM symbols');
      for (let offset = 0; offset < instruments.length; offset += BATCH_SIZE) {
        await this._insertBatch(client, instruments.slice(offset, offset + BATCH_SIZE));
      }
      await client.query(
        `INSERT INTO app_meta (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
        [REFRESHED_AT, String(this.clock.now())]
      );
    });
    return instruments.length;
  }

  _insertBatch(client, batch) {
    const values = batch
      .map((_, index) => `($${index * 4 + 1}, $${index * 4 + 2}, $${index * 4 + 3}, $${index * 4 + 4})`)
      .join(',');
    const params = batch.flatMap((item) => [item.symbol, item.name, item.kind, item.exchange ?? null]);
    return client.query(
      `INSERT INTO symbols (symbol, name, kind, exchange) VALUES ${values} ON CONFLICT (symbol) DO NOTHING`,
      params
    );
  }

  async has(symbol) {
    const { rows } = await this.db.query('SELECT 1 FROM symbols WHERE symbol = $1', [symbol]);
    return rows.length > 0;
  }

  async findMany(symbols) {
    if (symbols.length === 0) return [];
    const { rows } = await this.db.query('SELECT * FROM symbols WHERE symbol = ANY($1)', [symbols]);
    return rows.map(toInstrument);
  }

  async search(query, limit = 12) {
    const term = query.toUpperCase();
    const { rows } = await this.db.query(
      `SELECT * FROM symbols
       WHERE symbol = $1 OR symbol LIKE $2 OR name ILIKE $3
       ORDER BY CASE WHEN symbol = $1 THEN 0 WHEN symbol LIKE $2 THEN 1 ELSE 2 END,
                length(symbol), symbol
       LIMIT $4`,
      [term, `${term}%`, `%${query}%`, limit]
    );
    return rows.map(toInstrument);
  }
}
