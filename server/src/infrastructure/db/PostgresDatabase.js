import pg from 'pg';

/**
 * Owns the connection pool and the transaction boundary. Repositories depend on
 * this object, not on a module-level pool, so the composition root controls the
 * lifetime and shutdown is deterministic.
 *
 * @implements {import('../../domain/ports.js').SqlDatabase}
 */
export class PostgresDatabase {
  static open({ url, poolMax = 10, ssl = false, logger = console }) {
    const pool = new pg.Pool({
      connectionString: url,
      max: poolMax,
      ssl: ssl ? { rejectUnauthorized: false } : undefined,
    });
    pool.on('error', (error) => logger.error('[pg] idle client error —', error.message));
    return new PostgresDatabase(pool);
  }

  constructor(pool) {
    this.pool = pool;
  }

  query(sql, params) {
    return this.pool.query(sql, params);
  }

  /** Runs `work` inside a transaction, rolling back on any throw. */
  async transaction(work) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}
