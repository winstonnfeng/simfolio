import { TtlCache } from '../cache/TtlCache.js';

/**
 * Decorator that adds TTL caching to any MarketData implementation. It has the
 * same interface as what it wraps, so use cases are unaware of it and caching
 * can be added, retuned or removed without touching a single caller — the open/
 * closed principle doing real work rather than appearing in a comment.
 *
 * It also implements QuoteSnapshots, the narrow read-only port the socket
 * stream uses to read a previous close without provoking a fetch.
 *
 * @implements {import('../../domain/ports.js').MarketData}
 * @implements {import('../../domain/ports.js').QuoteSnapshots}
 */
export class CachingMarketData {
  constructor({ inner, clock, ttls = {} }) {
    this.inner = inner;
    this.ttls = {
      quote: ttls.quote ?? 15_000,
      profile: ttls.profile ?? 86_400_000,
      history: ttls.history ?? 300_000,
      search: ttls.search ?? 60_000,
    };
    this.cache = new TtlCache({ clock, defaultTtlMs: this.ttls.quote });
  }

  getQuote(symbol) {
    return this.cache.resolve(`quote:${symbol}`, () => this.inner.getQuote(symbol), this.ttls.quote);
  }

  /** QuoteSnapshots: last known quote, or null. Never fetches. */
  peek(symbol) {
    return this.cache.peek(`quote:${symbol}`);
  }

  async getQuotes(symbols) {
    const settled = await Promise.allSettled(symbols.map((symbol) => this.getQuote(symbol)));
    const quotes = {};
    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') quotes[symbols[index]] = result.value;
    });
    return quotes;
  }

  getPriceHistory(symbol, range) {
    return this.cache.resolve(
      `history:${symbol}:${range}`,
      () => this.inner.getPriceHistory(symbol, range),
      this.ttls.history
    );
  }

  getInstrument(symbol) {
    return this.cache.resolve(`profile:${symbol}`, () => this.inner.getInstrument(symbol), this.ttls.profile);
  }

  searchInstruments(query) {
    const trimmed = String(query ?? '').trim();
    if (trimmed === '') return Promise.resolve([]);
    return this.cache.resolve(
      `search:${trimmed.toUpperCase()}`,
      () => this.inner.searchInstruments(trimmed),
      this.ttls.search
    );
  }

  listPopular() {
    return this.cache.resolve('popular', () => this.inner.listPopular(), this.ttls.profile);
  }

  listSymbols() {
    return this.inner.listSymbols();
  }
}
