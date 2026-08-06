import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buy, sell, deposit, createPortfolio, summarize } from '../src/domain/portfolio.js';
import { InsufficientFundsError, InsufficientSharesError, ValidationError } from '../src/domain/errors.js';

/**
 * The domain takes its timestamp as an argument rather than calling Date.now(),
 * so every assertion below is deterministic.
 */
const NOW = 1_700_000_000_000;

test('buy reduces cash and records average cost', () => {
  const start = createPortfolio(100_00);
  const { portfolio, transaction } = buy(start, { symbol: 'AAPL', qty: 2, priceCents: 2_500, now: NOW });
  assert.equal(portfolio.cashCents, 5_000);
  assert.equal(portfolio.positions.AAPL.qty, 2);
  assert.equal(portfolio.positions.AAPL.avgCostCents, 2_500);
  assert.equal(transaction.amountCents, -5_000);
  assert.equal(transaction.createdAt, NOW);
});

test('buy does not mutate the portfolio it was given', () => {
  const start = createPortfolio(100_00);
  buy(start, { symbol: 'AAPL', qty: 2, priceCents: 2_500, now: NOW });
  assert.equal(start.cashCents, 100_00);
  assert.deepEqual(start.positions, {});
});

test('averaging up blends the cost basis', () => {
  let portfolio = createPortfolio(1_000_00);
  portfolio = buy(portfolio, { symbol: 'AAPL', qty: 10, priceCents: 10_000, now: NOW }).portfolio;
  portfolio = buy(portfolio, { symbol: 'AAPL', qty: 10, priceCents: 20_000, now: NOW }).portfolio;
  assert.equal(portfolio.positions.AAPL.avgCostCents, 15_000);
});

test('buying beyond buying power is rejected', () => {
  const portfolio = createPortfolio(1_000);
  assert.throws(() => buy(portfolio, { symbol: 'AAPL', qty: 1, priceCents: 5_000, now: NOW }), InsufficientFundsError);
});

test('selling more shares than held is rejected', () => {
  let portfolio = createPortfolio(100_000);
  portfolio = buy(portfolio, { symbol: 'KO', qty: 5, priceCents: 1_000, now: NOW }).portfolio;
  assert.throws(() => sell(portfolio, { symbol: 'KO', qty: 6, priceCents: 1_000, now: NOW }), InsufficientSharesError);
});

test('a partial sell keeps the position at its original cost basis', () => {
  let portfolio = createPortfolio(100_000);
  portfolio = buy(portfolio, { symbol: 'KO', qty: 10, priceCents: 1_000, now: NOW }).portfolio;
  const { portfolio: after, transaction } = sell(portfolio, { symbol: 'KO', qty: 4, priceCents: 1_500, now: NOW });
  assert.equal(after.positions.KO.qty, 6);
  assert.equal(after.positions.KO.avgCostCents, 1_000);
  assert.equal(transaction.realizedCents, 2_000);
});

test('a full sell closes the position and realises the gain', () => {
  let portfolio = createPortfolio(100_000);
  portfolio = buy(portfolio, { symbol: 'KO', qty: 5, priceCents: 1_000, now: NOW }).portfolio;
  const result = sell(portfolio, { symbol: 'KO', qty: 5, priceCents: 1_500, now: NOW });
  assert.equal(result.portfolio.positions.KO, undefined);
  assert.equal(result.transaction.realizedCents, 2_500);
});

test('fractional quantities are rejected', () => {
  assert.throws(
    () => buy(createPortfolio(100_000), { symbol: 'KO', qty: 1.5, priceCents: 100, now: NOW }),
    ValidationError
  );
});

test('a missing timestamp is rejected rather than defaulted', () => {
  assert.throws(() => buy(createPortfolio(100_000), { symbol: 'KO', qty: 1, priceCents: 100 }), ValidationError);
});

test('deposits increase both cash and funded total', () => {
  const { portfolio } = deposit(createPortfolio(0), { amountCents: 50_000, now: NOW });
  assert.equal(portfolio.cashCents, 50_000);
  assert.equal(portfolio.depositedCents, 50_000);
});

test('summarize values positions against live quotes', () => {
  let portfolio = createPortfolio(100_000);
  portfolio = buy(portfolio, { symbol: 'AAPL', qty: 10, priceCents: 1_000, now: NOW }).portfolio;
  const summary = summarize(portfolio, { AAPL: { priceCents: 1_200 } });
  assert.equal(summary.investedCents, 12_000);
  assert.equal(summary.unrealizedCents, 2_000);
  assert.equal(summary.totalCents, 102_000);
});

test('summarize falls back to cost when a quote is missing', () => {
  let portfolio = createPortfolio(100_000);
  portfolio = buy(portfolio, { symbol: 'AAPL', qty: 10, priceCents: 1_000, now: NOW }).portfolio;
  const summary = summarize(portfolio, {});
  assert.equal(summary.unrealizedCents, 0);
  assert.equal(summary.totalCents, 100_000);
});
