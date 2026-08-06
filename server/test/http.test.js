import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { createApp } from '../src/app.js';
import { createConfig } from '../src/config/config.js';
import { FixedClock } from '../src/domain/Clock.js';
import { PortfolioService } from '../src/application/services/PortfolioService.js';
import { RegisterUser } from '../src/application/RegisterUser.js';
import { LoginUser } from '../src/application/LoginUser.js';
import { GetPortfolio } from '../src/application/GetPortfolio.js';
import { PlaceOrder } from '../src/application/PlaceOrder.js';
import { DepositCash } from '../src/application/DepositCash.js';
import { ListTransactions } from '../src/application/ListTransactions.js';
import { ManageWatchlist } from '../src/application/ManageWatchlist.js';
import {
  InMemoryUserRepository,
  InMemoryPortfolioRepository,
  InMemoryWatchlistRepository,
  StubMarketData,
  SequentialIds,
  fakeHasher,
  fakeTokens,
} from './support/fakes.js';

/**
 * The HTTP layer end to end over fakes. createApp is a pure function of
 * (config, ports, useCases), so the whole routing, validation, auth and error
 * translation stack can be exercised with no database and no vendor keys.
 */
let server;
let baseUrl;

function buildContainer() {
  const users = new InMemoryUserRepository();
  const portfolios = new InMemoryPortfolioRepository();
  const watchlists = new InMemoryWatchlistRepository();
  const marketData = new StubMarketData({ AAPL: 10_000 });
  const clock = new FixedClock(1_700_000_000_000);
  const portfolioService = new PortfolioService({ portfolios, marketData });

  return {
    config: createConfig({ JWT_SECRET: 'test-secret' }),
    ports: {
      users,
      tokens: fakeTokens,
      broadcaster: { subscribe: () => () => {} },
    },
    useCases: {
      registerUser: new RegisterUser({
        users,
        portfolios,
        passwordHasher: fakeHasher,
        tokens: fakeTokens,
        ids: new SequentialIds('user'),
        clock,
        startingCashCents: 100_000,
      }),
      loginUser: new LoginUser({ users, passwordHasher: fakeHasher, tokens: fakeTokens }),
      getPortfolio: new GetPortfolio({ portfolioService }),
      placeOrder: new PlaceOrder({ portfolioService, marketData, clock }),
      depositCash: new DepositCash({ portfolioService, clock }),
      listTransactions: new ListTransactions({ portfolios }),
      manageWatchlist: new ManageWatchlist({ watchlists }),
      getMarketData: marketData,
      searchInstruments: { execute: async () => [], listPopular: async () => [] },
      getInstrument: { execute: async () => ({ instrument: null, quote: null }) },
    },
  };
}

before(async () => {
  server = createApp(buildContainer()).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

async function call(method, path, { body, token } = {}) {
  const response = await fetch(baseUrl + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

async function signUp(email = 'amanda@example.com') {
  const { body } = await call('POST', '/api/auth/register', {
    body: { name: 'Amanda Chen', email, password: 'demo123' },
  });
  return body.token;
}

test('health reports which adapters are in play', async () => {
  const { status, body } = await call('GET', '/health');
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.storage, 'sqlite');
});

test('an unknown route returns a structured 404', async () => {
  const { status, body } = await call('GET', '/api/nope');
  assert.equal(status, 404);
  assert.equal(body.error.code, 'NOT_FOUND');
});

test('protected routes reject a missing or malformed token', async () => {
  assert.equal((await call('GET', '/api/portfolio')).status, 401);
  assert.equal((await call('GET', '/api/portfolio', { token: 'garbage' })).status, 401);
});

test('a bad request body is rejected before reaching the use case', async () => {
  const token = await signUp('validation@example.com');
  const { status, body } = await call('POST', '/api/orders', {
    token,
    body: { side: 'buy', symbol: 'AAPL', qty: 0 },
  });
  assert.equal(status, 422);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});

test('register, trade and read back the portfolio', async () => {
  const token = await signUp();

  const order = await call('POST', '/api/orders', { token, body: { side: 'buy', symbol: 'AAPL', qty: 3 } });
  assert.equal(order.status, 201);
  assert.equal(order.body.execution.price, 100);

  const portfolio = await call('GET', '/api/portfolio', { token });
  assert.equal(portfolio.body.portfolio.cash, 700);
  assert.equal(portfolio.body.portfolio.positions[0].symbol, 'AAPL');

  const history = await call('GET', '/api/transactions', { token });
  assert.equal(history.body.transactions.length, 1);
});

test('a domain error becomes its own status code, not a 500', async () => {
  const token = await signUp('broke@example.com');
  const { status, body } = await call('POST', '/api/orders', {
    token,
    body: { side: 'buy', symbol: 'AAPL', qty: 999 },
  });
  assert.equal(status, 422);
  assert.equal(body.error.code, 'INSUFFICIENT_FUNDS');
});

test('a deposit increases buying power over HTTP', async () => {
  const token = await signUp('deposit@example.com');
  const { status, body } = await call('POST', '/api/cash/deposits', { token, body: { amount: 250 } });
  assert.equal(status, 201);
  assert.equal(body.portfolio.cash, 1250);
});

test('watchlist symbols are normalised through the API', async () => {
  const token = await signUp('watch@example.com');
  const { body } = await call('PUT', '/api/watchlist', { token, body: { symbols: ['tsla', 'ko'] } });
  assert.deepEqual(body.symbols, ['TSLA', 'KO']);
});
