import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FixedClock } from '../src/domain/Clock.js';
import { ConflictError, ValidationError } from '../src/domain/errors.js';
import { PortfolioService } from '../src/application/services/PortfolioService.js';
import { RegisterUser } from '../src/application/RegisterUser.js';
import { LoginUser } from '../src/application/LoginUser.js';
import { GetPortfolio } from '../src/application/GetPortfolio.js';
import { PlaceOrder } from '../src/application/PlaceOrder.js';
import { DepositCash } from '../src/application/DepositCash.js';
import { ListTransactions } from '../src/application/ListTransactions.js';
import { ManageWatchlist } from '../src/application/ManageWatchlist.js';
import { SeedDemoAccount } from '../src/application/SeedDemoAccount.js';
import {
  InMemoryUserRepository,
  InMemoryPortfolioRepository,
  InMemoryWatchlistRepository,
  StubMarketData,
  SequentialIds,
  fakeHasher,
  fakeTokens,
  silentLogger,
} from './support/fakes.js';

/**
 * Use cases under test with every collaborator faked. None of this touches a
 * database, a vendor API, or the system clock — which is only possible because
 * each use case receives its dependencies through its constructor.
 */
function buildHarness({ startingCashCents = 100_000, prices = { AAPL: 10_000, KO: 5_000 } } = {}) {
  const users = new InMemoryUserRepository();
  const portfolios = new InMemoryPortfolioRepository();
  const watchlists = new InMemoryWatchlistRepository();
  const marketData = new StubMarketData(prices);
  const clock = new FixedClock(1_700_000_000_000);
  const ids = new SequentialIds('user');
  const portfolioService = new PortfolioService({ portfolios, marketData });

  return {
    users,
    portfolios,
    watchlists,
    marketData,
    clock,
    registerUser: new RegisterUser({
      users,
      portfolios,
      passwordHasher: fakeHasher,
      tokens: fakeTokens,
      ids,
      clock,
      startingCashCents,
    }),
    loginUser: new LoginUser({ users, passwordHasher: fakeHasher, tokens: fakeTokens }),
    getPortfolio: new GetPortfolio({ portfolioService }),
    placeOrder: new PlaceOrder({ portfolioService, marketData, clock }),
    depositCash: new DepositCash({ portfolioService, clock }),
    listTransactions: new ListTransactions({ portfolios }),
    manageWatchlist: new ManageWatchlist({ watchlists }),
  };
}

const CREDENTIALS = { name: 'Amanda Chen', email: 'amanda@example.com', password: 'demo123' };

test('registering funds a new portfolio and issues a token', async () => {
  const app = buildHarness({ startingCashCents: 250_000 });
  const { user, token } = await app.registerUser.execute(CREDENTIALS);

  assert.equal(token, `token:${user.id}`);
  const { summary } = await app.getPortfolio.execute({ userId: user.id });
  assert.equal(summary.cashCents, 250_000);
  assert.equal(summary.depositedCents, 250_000);
  assert.deepEqual(summary.positions, []);
});

test('email is normalised, and a second signup on it is rejected', async () => {
  const app = buildHarness();
  await app.registerUser.execute({ ...CREDENTIALS, email: '  Amanda@Example.com ' });
  const stored = await app.users.findByEmail('amanda@example.com');
  assert.ok(stored);
  await assert.rejects(() => app.registerUser.execute(CREDENTIALS), ConflictError);
});

test('a short password never reaches the repository', async () => {
  const app = buildHarness();
  await assert.rejects(() => app.registerUser.execute({ ...CREDENTIALS, password: '12345' }), ValidationError);
  assert.equal(app.users.rows.size, 0);
});

test('login rejects a wrong password', async () => {
  const app = buildHarness();
  await app.registerUser.execute(CREDENTIALS);
  await assert.rejects(() => app.loginUser.execute({ email: CREDENTIALS.email, password: 'wrong' }));
  const session = await app.loginUser.execute({ email: CREDENTIALS.email, password: CREDENTIALS.password });
  assert.equal(session.user.email, CREDENTIALS.email);
});

test('an order executes at the market price, not a client-supplied one', async () => {
  const app = buildHarness();
  const { user } = await app.registerUser.execute(CREDENTIALS);

  const { execution } = await app.placeOrder.execute({
    userId: user.id,
    side: 'buy',
    symbol: 'aapl',
    qty: 3,
    priceCents: 1, // a hostile client; the use case must ignore it
  });

  assert.equal(execution.symbol, 'AAPL');
  assert.equal(execution.priceCents, 10_000);
  assert.equal(execution.amountCents, -30_000);
});

test('an unaffordable order leaves the portfolio untouched', async () => {
  const app = buildHarness({ startingCashCents: 5_000 });
  const { user } = await app.registerUser.execute(CREDENTIALS);

  await assert.rejects(() => app.placeOrder.execute({ userId: user.id, side: 'buy', symbol: 'AAPL', qty: 1 }));

  const { summary } = await app.getPortfolio.execute({ userId: user.id });
  assert.equal(summary.cashCents, 5_000);
  assert.equal((await app.listTransactions.execute({ userId: user.id })).length, 0);
});

test('an unknown side is rejected before any price is fetched', async () => {
  const app = buildHarness();
  const { user } = await app.registerUser.execute(CREDENTIALS);
  await assert.rejects(
    () => app.placeOrder.execute({ userId: user.id, side: 'short', symbol: 'AAPL', qty: 1 }),
    ValidationError
  );
  assert.equal(app.marketData.quoteCalls, 0);
});

test('a deposit raises buying power and is recorded in history', async () => {
  const app = buildHarness({ startingCashCents: 0 });
  const { user } = await app.registerUser.execute(CREDENTIALS);

  await app.depositCash.execute({ userId: user.id, amount: 500 });
  await app.placeOrder.execute({ userId: user.id, side: 'buy', symbol: 'KO', qty: 1 });

  const transactions = await app.listTransactions.execute({ userId: user.id });
  assert.deepEqual(
    transactions.map((t) => t.type),
    ['buy', 'deposit']
  );
});

test('watchlist symbols are normalised on the way in', async () => {
  const app = buildHarness();
  const symbols = await app.manageWatchlist.replace({ userId: 'u1', symbols: [' tsla ', 'ko'] });
  assert.deepEqual(symbols, ['TSLA', 'KO']);
  assert.deepEqual(await app.manageWatchlist.list({ userId: 'u1' }), ['TSLA', 'KO']);
});

test('seeding is idempotent and goes through the real use cases', async () => {
  const app = buildHarness({ startingCashCents: 1_000_000 });
  const seed = new SeedDemoAccount({ ...app, logger: silentLogger });
  const input = {
    credentials: CREDENTIALS,
    positions: [{ symbol: 'AAPL', qty: 2 }],
    watchlist: ['KO'],
  };

  const first = await seed.execute(input);
  assert.equal(first.created, true);

  const second = await seed.execute(input);
  assert.equal(second.created, false);
  assert.equal(app.users.rows.size, 1);

  const { summary } = await app.getPortfolio.execute({ userId: first.user.id });
  assert.equal(summary.positions.length, 1);
});
