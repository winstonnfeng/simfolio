import { multiplyCents } from '../shared/money.js';
import { InsufficientFundsError, InsufficientSharesError, ValidationError } from './errors.js';

/**
 * Pure portfolio domain. Every function takes a plain portfolio snapshot plus
 * an explicit timestamp and returns { portfolio, transaction }. No storage, no
 * HTTP, no ambient clock — this is the single source of truth for trade rules,
 * and the only layer that needs exhaustive unit tests.
 *
 * Portfolio shape:
 *   { cashCents, depositedCents, positions: { SYM: { symbol, qty, avgCostCents } } }
 */

export function createPortfolio(startingCashCents) {
  return { cashCents: startingCashCents, depositedCents: startingCashCents, positions: {} };
}

function assertQuantity(qty) {
  if (!Number.isInteger(qty) || qty <= 0) throw new ValidationError('Quantity must be a whole number greater than zero');
}

function assertPrice(priceCents) {
  if (!Number.isFinite(priceCents) || priceCents <= 0) throw new ValidationError('A tradable price is not available');
}

function assertTimestamp(now) {
  if (!Number.isFinite(now)) throw new ValidationError('A timestamp is required to record a transaction');
}

export function buy(portfolio, { symbol, qty, priceCents, now }) {
  assertQuantity(qty);
  assertPrice(priceCents);
  assertTimestamp(now);

  const costCents = multiplyCents(priceCents, qty);
  if (costCents > portfolio.cashCents) throw new InsufficientFundsError();

  const previous = portfolio.positions[symbol];
  const previousQty = previous?.qty ?? 0;
  const nextQty = previousQty + qty;
  const previousCost = previousQty * (previous?.avgCostCents ?? 0);
  const avgCostCents = Math.round((previousCost + costCents) / nextQty);

  return {
    portfolio: {
      ...portfolio,
      cashCents: portfolio.cashCents - costCents,
      positions: { ...portfolio.positions, [symbol]: { symbol, qty: nextQty, avgCostCents } },
    },
    transaction: { type: 'buy', symbol, qty, priceCents, amountCents: -costCents, realizedCents: 0, createdAt: now },
  };
}

export function sell(portfolio, { symbol, qty, priceCents, now }) {
  assertQuantity(qty);
  assertPrice(priceCents);
  assertTimestamp(now);

  const held = portfolio.positions[symbol];
  if (!held || held.qty < qty) throw new InsufficientSharesError();

  const proceedsCents = multiplyCents(priceCents, qty);
  const realizedCents = multiplyCents(priceCents - held.avgCostCents, qty);
  const positions = { ...portfolio.positions };
  const remaining = held.qty - qty;
  if (remaining === 0) delete positions[symbol];
  else positions[symbol] = { ...held, qty: remaining };

  return {
    portfolio: { ...portfolio, cashCents: portfolio.cashCents + proceedsCents, positions },
    transaction: { type: 'sell', symbol, qty, priceCents, amountCents: proceedsCents, realizedCents, createdAt: now },
  };
}

export function deposit(portfolio, { amountCents, now }) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new ValidationError('Deposit must be greater than zero');
  assertTimestamp(now);

  return {
    portfolio: {
      ...portfolio,
      cashCents: portfolio.cashCents + amountCents,
      depositedCents: portfolio.depositedCents + amountCents,
    },
    transaction: { type: 'deposit', symbol: null, qty: null, priceCents: null, amountCents, realizedCents: 0, createdAt: now },
  };
}

/** The trade operations, keyed by side, so callers select instead of branching. */
export const TRADES = Object.freeze({ buy, sell });

function valuePosition(position, quote) {
  const priceCents = quote?.priceCents ?? position.avgCostCents;
  const valueCents = multiplyCents(priceCents, position.qty);
  const costCents = multiplyCents(position.avgCostCents, position.qty);
  return {
    ...position,
    priceCents,
    valueCents,
    costCents,
    unrealizedCents: valueCents - costCents,
    unrealizedPct: percentOf(valueCents - costCents, costCents),
  };
}

function percentOf(part, whole) {
  return whole === 0 ? 0 : (part / whole) * 100;
}

/** Valuation is a read model: portfolio + quotes -> the numbers the UI needs. */
export function summarize(portfolio, quotesBySymbol = {}) {
  const positions = Object.values(portfolio.positions)
    .map((position) => valuePosition(position, quotesBySymbol[position.symbol]))
    .sort((a, b) => b.valueCents - a.valueCents);

  const investedCents = positions.reduce((sum, p) => sum + p.valueCents, 0);
  const costCents = positions.reduce((sum, p) => sum + p.costCents, 0);
  const totalCents = investedCents + portfolio.cashCents;
  const returnCents = totalCents - portfolio.depositedCents;

  return {
    positions,
    investedCents,
    cashCents: portfolio.cashCents,
    depositedCents: portfolio.depositedCents,
    totalCents,
    unrealizedCents: investedCents - costCents,
    unrealizedPct: percentOf(investedCents - costCents, costCents),
    returnCents,
    returnPct: percentOf(returnCents, portfolio.depositedCents),
  };
}
