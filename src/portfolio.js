// Portfolio domain. Pure reducers over an immutable portfolio object.
// No DOM, no storage, no formatting — trades in and new state out.

export const DEFAULT_STARTING_CASH = 100000;

export function createPortfolio(startingCash = DEFAULT_STARTING_CASH) {
  return {
    cash: startingCash,
    startingCash,
    deposited: startingCash,
    positions: {}, // symbol -> { symbol, qty, avgCost }
    transactions: [], // newest first
  };
}

function txn(type, fields) {
  return { id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, at: Date.now(), ...fields };
}

export function validateOrder(portfolio, side, symbol, qty, price) {
  if (!symbol) return 'Choose a security first.';
  if (!Number.isFinite(qty) || qty <= 0) return 'Enter a quantity greater than zero.';
  if (!Number.isInteger(qty)) return 'Whole shares only.';
  if (side === 'buy' && qty * price > portfolio.cash) return 'Not enough buying power for this order.';
  if (side === 'sell') {
    const held = portfolio.positions[symbol]?.qty || 0;
    if (held === 0) return `You do not own any ${symbol}.`;
    if (qty > held) return `You only hold ${held} ${qty === 1 ? 'share' : 'shares'} of ${symbol}.`;
  }
  return null;
}

export function buy(portfolio, symbol, qty, price) {
  const error = validateOrder(portfolio, 'buy', symbol, qty, price);
  if (error) return { ok: false, error, portfolio };
  const cost = qty * price;
  const prev = portfolio.positions[symbol];
  const nextQty = (prev?.qty || 0) + qty;
  const nextAvg = ((prev?.qty || 0) * (prev?.avgCost || 0) + cost) / nextQty;
  return {
    ok: true,
    error: null,
    portfolio: {
      ...portfolio,
      cash: portfolio.cash - cost,
      positions: { ...portfolio.positions, [symbol]: { symbol, qty: nextQty, avgCost: nextAvg } },
      transactions: [txn('buy', { symbol, qty, price, amount: -cost }), ...portfolio.transactions],
    },
  };
}

export function sell(portfolio, symbol, qty, price) {
  const error = validateOrder(portfolio, 'sell', symbol, qty, price);
  if (error) return { ok: false, error, portfolio };
  const proceeds = qty * price;
  const prev = portfolio.positions[symbol];
  const positions = { ...portfolio.positions };
  const remaining = prev.qty - qty;
  if (remaining <= 0) delete positions[symbol];
  else positions[symbol] = { ...prev, qty: remaining };
  const realized = (price - prev.avgCost) * qty;
  return {
    ok: true,
    error: null,
    portfolio: {
      ...portfolio,
      cash: portfolio.cash + proceeds,
      positions,
      transactions: [txn('sell', { symbol, qty, price, amount: proceeds, realized }), ...portfolio.transactions],
    },
  };
}

export function deposit(portfolio, amount) {
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Enter an amount greater than zero.', portfolio };
  return {
    ok: true,
    error: null,
    portfolio: {
      ...portfolio,
      cash: portfolio.cash + amount,
      deposited: portfolio.deposited + amount,
      transactions: [txn('deposit', { amount }), ...portfolio.transactions],
    },
  };
}

/** Positions decorated with live valuation, sorted by market value. */
export function valuePositions(portfolio, prices) {
  return Object.values(portfolio.positions)
    .map((p) => {
      const price = prices[p.symbol] ?? p.avgCost;
      const value = p.qty * price;
      const cost = p.qty * p.avgCost;
      return { ...p, price, value, cost, pl: value - cost, plPct: cost ? ((value - cost) / cost) * 100 : 0 };
    })
    .sort((a, b) => b.value - a.value);
}

export function summarize(portfolio, prices) {
  const positions = valuePositions(portfolio, prices);
  const invested = positions.reduce((s, p) => s + p.value, 0);
  const cost = positions.reduce((s, p) => s + p.cost, 0);
  const total = invested + portfolio.cash;
  const returnAbs = total - portfolio.deposited;
  return {
    positions,
    invested,
    cash: portfolio.cash,
    total,
    unrealized: invested - cost,
    unrealizedPct: cost ? ((invested - cost) / cost) * 100 : 0,
    returnAbs,
    returnPct: portfolio.deposited ? (returnAbs / portfolio.deposited) * 100 : 0,
  };
}
