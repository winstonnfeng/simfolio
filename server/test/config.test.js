import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createConfig, describeConfig } from '../src/config/config.js';

/**
 * config is built from a source object rather than read from process.env at
 * import time, so these run without touching the real environment.
 */

test('provider selection is derived from which keys are present', () => {
  const none = createConfig({ JWT_SECRET: 's' }).market;
  assert.equal(none.quoteProvider, 'static');
  assert.equal(none.historyProvider, 'static');
  assert.equal(none.streamProvider, 'polling');

  const finnhubOnly = createConfig({ JWT_SECRET: 's', FINNHUB_API_KEY: 'k' }).market;
  assert.equal(finnhubOnly.quoteProvider, 'finnhub');
  assert.equal(finnhubOnly.historyProvider, 'stooq');
  assert.equal(finnhubOnly.streamProvider, 'finnhub-socket');

  const both = createConfig({ JWT_SECRET: 's', FINNHUB_API_KEY: 'k', TWELVEDATA_API_KEY: 't' }).market;
  assert.equal(both.historyProvider, 'twelvedata');
});

test('the database driver follows DATABASE_URL', () => {
  assert.equal(createConfig({ JWT_SECRET: 's' }).database.driver, 'sqlite');
  assert.equal(createConfig({ JWT_SECRET: 's', DATABASE_URL: 'postgres://x' }).database.driver, 'postgres');
});

test('numeric settings are parsed, with fallbacks for junk', () => {
  const config = createConfig({ JWT_SECRET: 's', PORT: '8080', PG_POOL_MAX: 'not-a-number' });
  assert.equal(config.http.port, 8080);
  assert.equal(config.database.poolMax, 10);
});

test('starting cash is stored in cents', () => {
  assert.equal(createConfig({ JWT_SECRET: 's', STARTING_CASH: '2500.50' }).trading.startingCashCents, 250_050);
});

test('config is frozen so nothing can reconfigure the app at runtime', () => {
  const config = createConfig({ JWT_SECRET: 's' });
  assert.throws(() => {
    config.http.port = 1;
  }, TypeError);
});

test('describeConfig summarises the adapters in play', () => {
  const config = createConfig({ JWT_SECRET: 's', DATABASE_URL: 'postgres://x' });
  assert.deepEqual(describeConfig(config), {
    storage: 'postgres',
    quotes: 'static',
    history: 'static',
    stream: 'polling',
  });
});
