import { toDollars } from '../../../shared/money.js';

/**
 * The HTTP boundary speaks dollars; the domain speaks cents. All conversion
 * happens here so no other layer has to think about it.
 */
export function presentSummary(summary) {
  return {
    total: toDollars(summary.totalCents),
    cash: toDollars(summary.cashCents),
    invested: toDollars(summary.investedCents),
    deposited: toDollars(summary.depositedCents),
    unrealized: toDollars(summary.unrealizedCents),
    unrealizedPct: Number(summary.unrealizedPct.toFixed(2)),
    totalReturn: toDollars(summary.returnCents),
    totalReturnPct: Number(summary.returnPct.toFixed(2)),
    positions: summary.positions.map((position) => ({
      symbol: position.symbol,
      qty: position.qty,
      avgCost: toDollars(position.avgCostCents),
      price: toDollars(position.priceCents),
      value: toDollars(position.valueCents),
      unrealized: toDollars(position.unrealizedCents),
      unrealizedPct: Number(position.unrealizedPct.toFixed(2)),
    })),
  };
}

export function presentTransaction(transaction) {
  return {
    id: transaction.id,
    type: transaction.type,
    symbol: transaction.symbol,
    qty: transaction.qty,
    price: transaction.priceCents === null ? null : toDollars(transaction.priceCents),
    amount: toDollars(transaction.amountCents),
    realized: toDollars(transaction.realizedCents ?? 0),
    createdAt: transaction.createdAt,
  };
}

export function presentQuote(quote) {
  return {
    symbol: quote.symbol,
    price: toDollars(quote.priceCents),
    previousClose: toDollars(quote.previousCloseCents),
    change: toDollars(quote.changeCents ?? 0),
    changePct: Number((quote.changePct ?? 0).toFixed(2)),
    at: quote.at,
  };
}

export function presentPriceHistory(history) {
  return {
    symbol: history.symbol,
    range: history.range,
    granularity: history.granularity ?? null,
    points: history.points.map((point) => ({ t: point.t, price: toDollars(point.priceCents) })),
  };
}
