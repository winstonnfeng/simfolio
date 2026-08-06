import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { SqliteDatabase } from '../src/infrastructure/db/SqliteDatabase.js';
import { runMigrations } from '../src/infrastructure/db/runMigrations.js';
import { SqliteUserRepository } from '../src/infrastructure/repositories/SqliteUserRepository.js';
import { SqlitePortfolioRepository } from '../src/infrastructure/repositories/SqlitePortfolioRepository.js';
import { SqliteWatchlistRepository } from '../src/infrastructure/repositories/SqliteWatchlistRepository.js';
import { createPortfolio, buy } from '../src/domain/portfolio.js';
import { FixedClock } from '../src/domain/Clock.js';
import { SequentialIds, silentLogger } from './support/fakes.js';

/**
 * The real SQLite adapters, against a throwaway in-memory database. Because the
 * connection is injected rather than opened by the repositories themselves,
 * this needs no files, no environment, and no cleanup.
 */
let db;
let repos;
const clock = new FixedClock(1_700_000_000_000);

beforeEach(async () => {
  db = SqliteDatabase.open({ file: ':memory:' });
  await runMigrations({ db, driver: 'sqlite', logger: silentLogger });
  const deps = { db, ids: new SequentialIds('row'), clock };
  repos = {
    users: new SqliteUserRepository(deps),
    portfolios: new SqlitePortfolioRepository(deps),
    watchlists: new SqliteWatchlistRepository(deps),
  };
});

async function createUser(id = 'u1') {
  return repos.users.create({
    id,
    name: 'Amanda Chen',
    email: `${id}@example.com`,
    passwordHash: 'hashed',
    createdAt: clock.now(),
  });
}

test('migrations are idempotent', async () => {
  await runMigrations({ db, driver: 'sqlite', logger: silentLogger });
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get();
  assert.ok(count >= 1);
});

test('a user round-trips by id and by email', async () => {
  const created = await createUser();
  assert.deepEqual(await repos.users.findById(created.id), created);
  assert.equal((await repos.users.findByEmail('u1@example.com')).id, created.id);
  assert.equal(await repos.users.findByEmail('nobody@example.com'), null);
});

test('a trade writes cash, positions and history in one transaction', async () => {
  const user = await createUser();
  await repos.portfolios.create(user.id, createPortfolio(100_000));

  const result = buy(createPortfolio(100_000), { symbol: 'AAPL', qty: 2, priceCents: 10_000, now: clock.now() });
  await repos.portfolios.applyTrade(user.id, result.portfolio, result.transaction);

  const stored = await repos.portfolios.findByUserId(user.id);
  assert.equal(stored.cashCents, 80_000);
  assert.equal(stored.positions.AAPL.qty, 2);

  const [transaction] = await repos.portfolios.listTransactions(user.id);
  assert.equal(transaction.type, 'buy');
  assert.equal(transaction.amountCents, -20_000);
});

test('a failed write inside applyTrade leaves nothing behind', async () => {
  const user = await createUser();
  await repos.portfolios.create(user.id, createPortfolio(100_000));

  const broken = {
    portfolio: { cashCents: 1, depositedCents: 1, positions: { AAPL: { symbol: 'AAPL', qty: -5, avgCostCents: 1 } } },
    transaction: { type: 'buy', symbol: 'AAPL', qty: 1, priceCents: 1, amountCents: -1, realizedCents: 0, createdAt: clock.now() },
  };

  // qty > 0 is a CHECK constraint, so the positions insert fails mid-transaction.
  await assert.rejects(() => repos.portfolios.applyTrade(user.id, broken.portfolio, broken.transaction));

  const stored = await repos.portfolios.findByUserId(user.id);
  assert.equal(stored.cashCents, 100_000, 'cash must not have been updated');
  assert.equal((await repos.portfolios.listTransactions(user.id)).length, 0);
});

test('transactions come back newest first', async () => {
  const user = await createUser();
  await repos.portfolios.create(user.id, createPortfolio(1_000_000));

  let portfolio = createPortfolio(1_000_000);
  for (const [index, symbol] of ['AAPL', 'KO', 'VOO'].entries()) {
    const result = buy(portfolio, { symbol, qty: 1, priceCents: 1_000, now: clock.now() + index * 1_000 });
    portfolio = result.portfolio;
    await repos.portfolios.applyTrade(user.id, result.portfolio, result.transaction);
  }

  const history = await repos.portfolios.listTransactions(user.id);
  assert.deepEqual(
    history.map((t) => t.symbol),
    ['VOO', 'KO', 'AAPL']
  );
});

test('replacing a watchlist preserves order and clears the previous set', async () => {
  const user = await createUser();
  await repos.watchlists.replace(user.id, ['NVDA', 'VOO', 'KO']);
  assert.deepEqual(await repos.watchlists.list(user.id), ['NVDA', 'VOO', 'KO']);

  await repos.watchlists.replace(user.id, ['TSLA']);
  assert.deepEqual(await repos.watchlists.list(user.id), ['TSLA']);
});

test('an unknown account raises NotFound rather than returning empty data', async () => {
  await assert.rejects(() => repos.portfolios.listTransactions('missing-user'));
  assert.equal(await repos.portfolios.findByUserId('missing-user'), null);
});
