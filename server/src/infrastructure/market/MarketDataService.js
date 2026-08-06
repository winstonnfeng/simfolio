import { POPULAR_SYMBOLS } from './ranges.js';

/**
 * Composes the two vendor ports and the local symbol table into the single
 * MarketData port the application depends on. Deliberately has no cache: that
 * is a separate concern, added by wrapping this in CachingMarketData.
 *
 * @param {{ quotes: import('../../domain/ports.js').QuoteProvider,
 *           history: import('../../domain/ports.js').HistoryProvider,
 *           symbols: import('../../domain/ports.js').SymbolRepository }} deps
 */
export class MarketDataService {
  constructor({ quotes, history, symbols }) {
    this.quotes = quotes;
    this.history = history;
    this.symbols = symbols;
  }

  getQuote(symbol) {
    return this.quotes.getQuote(symbol);
  }

  /** One failing symbol must not fail a whole watchlist. */
  async getQuotes(symbols) {
    const settled = await Promise.allSettled(symbols.map((symbol) => this.getQuote(symbol)));
    const quotes = {};
    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') quotes[symbols[index]] = result.value;
    });
    return quotes;
  }

  getPriceHistory(symbol, range) {
    return this.history.getPriceHistory(symbol, range);
  }

  getInstrument(symbol) {
    return this.quotes.getProfile(symbol);
  }

  /** Local symbol table first (instant, no quota), vendor search as fallback. */
  async searchInstruments(query) {
    const trimmed = String(query ?? '').trim();
    if (trimmed === '') return [];
    const local = await this.symbols.search(trimmed, 12);
    return local.length > 0 ? local : this.quotes.searchSymbols(trimmed);
  }

  async listPopular() {
    const rows = await this.symbols.findMany(POPULAR_SYMBOLS);
    if (rows.length > 0) return rows;
    const all = await this.quotes.listSymbols();
    return all.slice(0, 14);
  }

  listSymbols() {
    return this.quotes.listSymbols();
  }
}
