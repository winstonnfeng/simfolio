import { ValidationError } from '../domain/errors.js';
import { normalizeSymbol } from '../domain/Symbol.js';
import { TRADES } from '../domain/portfolio.js';

/**
 * Places a market order. The execution price always comes from the market data
 * port server-side — a client-supplied price is never trusted, which is the
 * whole reason this is a use case and not a client-side calculation.
 */
export class PlaceOrder {
  constructor({ portfolioService, marketData, clock }) {
    this.portfolioService = portfolioService;
    this.marketData = marketData;
    this.clock = clock;
  }

  async execute({ userId, side, symbol, qty }) {
    const trade = TRADES[side];
    if (!trade) throw new ValidationError('Side must be "buy" or "sell"');
    const ticker = normalizeSymbol(symbol);

    const [portfolio, quote] = await Promise.all([
      this.portfolioService.loadOrFail(userId),
      this.marketData.getQuote(ticker),
    ]);

    const result = trade(portfolio, {
      symbol: ticker,
      qty: Number(qty),
      priceCents: quote.priceCents,
      now: this.clock.now(),
    });

    const { transaction, summary } = await this.portfolioService.commit(userId, result);
    return { execution: transaction, summary };
  }
}
