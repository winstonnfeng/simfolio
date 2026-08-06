/** @implements {import('../../domain/ports.js').WatchlistRepository} */
export class PgWatchlistRepository {
  constructor({ db }) {
    this.db = db;
  }

  async list(userId) {
    const { rows } = await this.db.query(
      'SELECT symbol FROM watchlist_items WHERE user_id = $1 ORDER BY sort ASC',
      [userId]
    );
    return rows.map((row) => row.symbol);
  }

  async replace(userId, symbols) {
    await this.db.transaction(async (client) => {
      await client.query('DELETE FROM watchlist_items WHERE user_id = $1', [userId]);
      for (const [index, symbol] of symbols.entries()) {
        await client.query('INSERT INTO watchlist_items (user_id, symbol, sort) VALUES ($1, $2, $3)', [
          userId,
          symbol,
          index,
        ]);
      }
    });
    return symbols;
  }
}
