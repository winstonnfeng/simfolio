/**
 * Row -> entity mapping, shared by both drivers. Postgres returns BIGINT as a
 * string and TIMESTAMPTZ as a Date, so it passes converters; SQLite stores
 * integers already and passes none. Keeping the shape in one file is what stops
 * the two drivers from quietly returning different objects.
 */

const identity = (value) => value;

export function toUser(row, { timestamp = identity } = {}) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: timestamp(row.created_at),
  };
}

export function toPosition(row, { cents = identity } = {}) {
  return { symbol: row.symbol, qty: Number(row.qty), avgCostCents: cents(row.avg_cost_cents) };
}

export function toPositionMap(rows, options) {
  return Object.fromEntries(rows.map((row) => [row.symbol, toPosition(row, options)]));
}

export function toAccount(row, positions, { cents = identity } = {}) {
  if (!row) return null;
  return {
    accountId: row.id,
    cashCents: cents(row.cash_cents),
    depositedCents: cents(row.deposited_cents),
    positions,
  };
}

export function toTransaction(row, { cents = identity, timestamp = identity } = {}) {
  return {
    id: row.id,
    type: row.type,
    symbol: row.symbol,
    qty: row.qty === null ? null : Number(row.qty),
    priceCents: row.price_cents === null ? null : cents(row.price_cents),
    amountCents: cents(row.amount_cents),
    realizedCents: cents(row.realized_cents),
    createdAt: timestamp(row.created_at),
  };
}

export function toInstrument(row) {
  return { symbol: row.symbol, name: row.name, kind: row.kind, exchange: row.exchange };
}

/** Postgres converters: BIGINT arrives as a string, TIMESTAMPTZ as a Date. */
export const PG = Object.freeze({
  cents: (value) => Number(value),
  timestamp: (value) => (value instanceof Date ? value.getTime() : Date.parse(value)),
});
