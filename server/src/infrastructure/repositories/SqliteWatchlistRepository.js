/** @implements {import('../../domain/ports.js').WatchlistRepository} */
export class SqliteWatchlistRepository {
  constructor({ db }) {
    this.db = db;
  }

  async list(userId) {
    return this.db
      .prepare('SELECT symbol FROM watchlist_items WHERE user_id = ? ORDER BY sort ASC')
      .all(userId)
      .map((row) => row.symbol);
  }

  async replace(userId, symbols) {
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM watchlist_items WHERE user_id = ?').run(userId);
      const insert = this.db.prepare('INSERT INTO watchlist_items (user_id, symbol, sort) VALUES (?, ?, ?)');
      symbols.forEach((symbol, index) => insert.run(userId, symbol, index));
    });
    return symbols;
  }
}
