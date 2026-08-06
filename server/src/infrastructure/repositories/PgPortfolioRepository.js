import { NotFoundError } from '../../domain/errors.js';
import { PG, toAccount, toPositionMap, toTransaction } from './rowMappers.js';

/**
 * Postgres implementation of PortfolioRepository. Same contract as the SQLite
 * one; the difference is that a trade runs in a real transaction with a row
 * lock, so two concurrent orders on one account cannot interleave.
 *
 * @implements {import('../../domain/ports.js').PortfolioRepository}
 */
export class PgPortfolioRepository {
  constructor({ db, ids }) {
    this.db = db;
    this.ids = ids;
  }

  async create(userId, portfolio) {
    const id = this.ids.next();
    await this.db.query(
      'INSERT INTO accounts (id, user_id, cash_cents, deposited_cents) VALUES ($1, $2, $3, $4)',
      [id, userId, portfolio.cashCents, portfolio.depositedCents]
    );
    return { ...portfolio, accountId: id };
  }

  async findByUserId(userId) {
    const { rows } = await this.db.query('SELECT * FROM accounts WHERE user_id = $1', [userId]);
    const account = rows[0];
    if (!account) return null;
    const positions = await this.db.query(
      'SELECT symbol, qty, avg_cost_cents FROM positions WHERE account_id = $1',
      [account.id]
    );
    return toAccount(account, toPositionMap(positions.rows, PG), PG);
  }

  async applyTrade(userId, portfolio, transaction) {
    return this.db.transaction(async (client) => {
      const accountId = await this._lockAccount(client, userId);
      await this._writeAccount(client, accountId, portfolio);
      await this._rewritePositions(client, accountId, portfolio.positions);
      await this._appendTransaction(client, accountId, transaction);
      return portfolio;
    });
  }

  /** FOR UPDATE serialises concurrent orders against the same account. */
  async _lockAccount(client, userId) {
    const { rows } = await client.query('SELECT id FROM accounts WHERE user_id = $1 FOR UPDATE', [userId]);
    if (rows.length === 0) throw new NotFoundError('Account not found');
    return rows[0].id;
  }

  _writeAccount(client, accountId, portfolio) {
    return client.query('UPDATE accounts SET cash_cents = $1, deposited_cents = $2 WHERE id = $3', [
      portfolio.cashCents,
      portfolio.depositedCents,
      accountId,
    ]);
  }

  async _rewritePositions(client, accountId, positions) {
    await client.query('DELETE FROM positions WHERE account_id = $1', [accountId]);
    for (const position of Object.values(positions)) {
      await client.query(
        'INSERT INTO positions (account_id, symbol, qty, avg_cost_cents) VALUES ($1, $2, $3, $4)',
        [accountId, position.symbol, position.qty, position.avgCostCents]
      );
    }
  }

  _appendTransaction(client, accountId, transaction) {
    return client.query(
      `INSERT INTO transactions (id, account_id, type, symbol, qty, price_cents, amount_cents, realized_cents, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, to_timestamp($9 / 1000.0))`,
      [
        this.ids.next(),
        accountId,
        transaction.type,
        transaction.symbol,
        transaction.qty,
        transaction.priceCents,
        transaction.amountCents,
        transaction.realizedCents,
        transaction.createdAt,
      ]
    );
  }

  async listTransactions(userId, limit = 100) {
    const { rows } = await this.db.query(
      `SELECT t.* FROM transactions t
       JOIN accounts a ON a.id = t.account_id
       WHERE a.user_id = $1
       ORDER BY t.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return rows.map((row) => toTransaction(row, PG));
  }
}
