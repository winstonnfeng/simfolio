import { NotFoundError } from '../../domain/errors.js';
import { toAccount, toPositionMap, toTransaction } from './rowMappers.js';

/**
 * Maps the relational account/positions/transactions tables to and from the
 * plain portfolio snapshot the domain works with. A trade is written in one
 * transaction so cash, positions and history can never drift apart.
 *
 * @implements {import('../../domain/ports.js').PortfolioRepository}
 */
export class SqlitePortfolioRepository {
  constructor({ db, ids, clock }) {
    this.db = db;
    this.ids = ids;
    this.clock = clock;
  }

  _accountId(userId) {
    const row = this.db.prepare('SELECT id FROM accounts WHERE user_id = ?').get(userId);
    if (!row) throw new NotFoundError('Account not found');
    return row.id;
  }

  async create(userId, portfolio) {
    const id = this.ids.next();
    this.db
      .prepare('INSERT INTO accounts (id, user_id, cash_cents, deposited_cents, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, userId, portfolio.cashCents, portfolio.depositedCents, this.clock.now());
    return { ...portfolio, accountId: id };
  }

  async findByUserId(userId) {
    const account = this.db.prepare('SELECT * FROM accounts WHERE user_id = ?').get(userId);
    if (!account) return null;
    const rows = this.db
      .prepare('SELECT symbol, qty, avg_cost_cents FROM positions WHERE account_id = ?')
      .all(account.id);
    return toAccount(account, toPositionMap(rows));
  }

  async applyTrade(userId, portfolio, transaction) {
    const accountId = this._accountId(userId);
    this.db.transaction(() => {
      this._writeAccount(accountId, portfolio);
      this._rewritePositions(accountId, portfolio.positions);
      this._appendTransaction(accountId, transaction);
    });
    return portfolio;
  }

  _writeAccount(accountId, portfolio) {
    this.db
      .prepare('UPDATE accounts SET cash_cents = ?, deposited_cents = ? WHERE id = ?')
      .run(portfolio.cashCents, portfolio.depositedCents, accountId);
  }

  /** Positions are rewritten wholesale: simple, and always internally consistent. */
  _rewritePositions(accountId, positions) {
    this.db.prepare('DELETE FROM positions WHERE account_id = ?').run(accountId);
    const insert = this.db.prepare(
      'INSERT INTO positions (account_id, symbol, qty, avg_cost_cents) VALUES (?, ?, ?, ?)'
    );
    for (const position of Object.values(positions)) {
      insert.run(accountId, position.symbol, position.qty, position.avgCostCents);
    }
  }

  _appendTransaction(accountId, transaction) {
    this.db
      .prepare(
        `INSERT INTO transactions (id, account_id, type, symbol, qty, price_cents, amount_cents, realized_cents, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        this.ids.next(),
        accountId,
        transaction.type,
        transaction.symbol,
        transaction.qty,
        transaction.priceCents,
        transaction.amountCents,
        transaction.realizedCents,
        transaction.createdAt
      );
  }

  async listTransactions(userId, limit = 100) {
    const accountId = this._accountId(userId);
    return this.db
      .prepare('SELECT * FROM transactions WHERE account_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(accountId, limit)
      .map((row) => toTransaction(row));
  }
}
