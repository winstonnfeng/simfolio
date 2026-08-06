import { normalizeSymbol, normalizeSymbols } from '../domain/Symbol.js';

/** Read-only market queries. Ticker normalisation happens once, here. */
export class GetMarketData {
  constructor({ marketData }) {
    this.marketData = marketData;
  }

  getQuote(symbol) {
    return this.marketData.getQuote(normalizeSymbol(symbol));
  }

  getQuotes(symbols) {
    return this.marketData.getQuotes(normalizeSymbols(symbols));
  }

  getPriceHistory(symbol, range) {
    return this.marketData.getPriceHistory(normalizeSymbol(symbol), range);
  }
}
