import { NotFoundError } from '../../domain/errors.js';
import { summarize } from '../../domain/portfolio.js';

/**
 * The three steps every portfolio use case repeated: load the snapshot (or
 * fail), price it against live quotes, and persist a domain result. Extracting
 * them leaves each use case expressing only its own decision.
 *
 * @param {{ portfolios: import('../../domain/ports.js').PortfolioRepository,
 *           marketData: import('../../domain/ports.js').MarketData }} deps
 */
export class PortfolioService {
  constructor({ portfolios, marketData }) {
    this.portfolios = portfolios;
    this.marketData = marketData;
  }

  async loadOrFail(userId) {
    const portfolio = await this.portfolios.findByUserId(userId);
    if (!portfolio) throw new NotFoundError('Portfolio not found');
    return portfolio;
  }

  /** Values a snapshot against current prices. One bad symbol cannot fail it. */
  async summarize(portfolio) {
    const symbols = Object.keys(portfolio.positions);
    const quotes = symbols.length > 0 ? await this.marketData.getQuotes(symbols) : {};
    return { summary: summarize(portfolio, quotes), quotes };
  }

  /** Persists a { portfolio, transaction } domain result and re-prices it. */
  async commit(userId, result) {
    await this.portfolios.applyTrade(userId, result.portfolio, result.transaction);
    const { summary } = await this.summarize(result.portfolio);
    return { transaction: result.transaction, summary };
  }
}
