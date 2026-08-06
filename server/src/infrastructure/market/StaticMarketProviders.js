import { NotFoundError } from '../../domain/errors.js';
import { toCents } from '../../shared/money.js';
import { POPULAR_SYMBOLS, rangeOf } from './ranges.js';

const SEED = [
  ['AAPL', 'Apple Inc.', 'Stock', 'Technology', 227.42, 3.44e12, 34.6, 0.44],
  ['MSFT', 'Microsoft Corp.', 'Stock', 'Technology', 441.18, 3.28e12, 36.1, 0.68],
  ['NVDA', 'NVIDIA Corp.', 'Stock', 'Semiconductors', 128.63, 3.16e12, 52.4, 0.03],
  ['AMZN', 'Amazon.com Inc.', 'Stock', 'Consumer', 197.85, 2.07e12, 41.2, 0],
  ['GOOGL', 'Alphabet Inc.', 'Stock', 'Technology', 178.34, 2.18e12, 24.8, 0.45],
  ['META', 'Meta Platforms', 'Stock', 'Technology', 563.27, 1.42e12, 27.3, 0.35],
  ['TSLA', 'Tesla Inc.', 'Stock', 'Automotive', 246.91, 7.88e11, 61.9, 0],
  ['JPM', 'JPMorgan Chase', 'Stock', 'Financials', 214.06, 6.02e11, 12.1, 2.14],
  ['KO', 'Coca-Cola Co.', 'Stock', 'Consumer', 71.48, 3.08e11, 26.4, 2.71],
  ['COST', 'Costco Wholesale', 'Stock', 'Consumer', 884.55, 3.92e11, 53.8, 0.51],
  ['VOO', 'Vanguard S&P 500 ETF', 'ETF', 'Broad market', 512.36, 5.31e11, 25.9, 1.28],
  ['QQQ', 'Invesco QQQ Trust', 'ETF', 'Nasdaq 100', 479.12, 2.94e11, 32.7, 0.58],
  ['VTI', 'Vanguard Total Market', 'ETF', 'Broad market', 281.74, 4.18e11, 24.6, 1.31],
  ['SCHD', 'Schwab US Dividend', 'ETF', 'Dividend', 82.91, 6.14e10, 16.2, 3.42],
  ['SHOP.TO', 'Shopify Inc.', 'Stock', 'Technology', 148.32, 1.91e11, 71.4, 0],
  ['RY.TO', 'Royal Bank of Canada', 'Stock', 'Financials', 168.44, 2.37e11, 13.8, 3.36],
  ['TD.TO', 'Toronto-Dominion Bank', 'Stock', 'Financials', 78.21, 1.37e11, 11.2, 5.24],
  ['ENB.TO', 'Enbridge Inc.', 'Stock', 'Energy', 59.87, 1.3e11, 21.6, 6.12],
  ['CNR.TO', 'Canadian National Railway', 'Stock', 'Industrials', 152.6, 9.6e10, 19.4, 2.21],
  ['CNQ.TO', 'Canadian Natural Resources', 'Stock', 'Energy', 44.72, 9.4e10, 12.7, 4.75],
  ['BCE.TO', 'BCE Inc.', 'Stock', 'Telecom', 33.15, 3.03e10, 17.9, 8.41],
  ['XIU.TO', 'iShares S&P/TSX 60 ETF', 'ETF', 'Broad market', 38.94, 1.42e10, 17.1, 2.86],
].map(([symbol, name, kind, sector, referencePrice, mktCap, peRatio, divYield]) => ({
  symbol, name, kind, sector, referencePrice, mktCap, peRatio, divYield,
}));

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const find = (symbol) => SEED.find((entry) => entry.symbol === symbol) ?? null;

/** Deterministic offline quotes, so the API boots and tests run without vendors. */
export class StaticQuoteProvider {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
  }

  async listSymbols() {
    return SEED.map(({ symbol, name, kind }) => ({
      symbol,
      name,
      kind,
      exchange: symbol.endsWith('.TO') ? 'TSX' : 'DEMO',
      market: symbol.endsWith('.TO') ? 'CA' : 'US',
    }));
  }

  async searchSymbols(query) {
    const needle = query.toUpperCase();
    return SEED.filter((entry) => entry.symbol.includes(needle) || entry.name.toUpperCase().includes(needle))
      .slice(0, 12)
      .map(({ symbol, name, kind }) => ({ symbol, name, kind, market: symbol.endsWith('.TO') ? 'CA' : 'US' }));
  }

  async getQuote(symbol) {
    const instrument = find(symbol);
    if (!instrument) throw new NotFoundError(`${symbol} is not available in offline mode`);
    const random = seededRandom(hashString(symbol + ':' + Math.floor(this.now() / 60000)));
    const price = instrument.referencePrice * (1 + (random() - 0.5) * 0.02);
    const previousClose = instrument.referencePrice * (1 + ((hashString(symbol) % 400) - 190) / 10000);
    return {
      symbol,
      priceCents: toCents(price),
      previousCloseCents: toCents(previousClose),
      changeCents: toCents(price - previousClose),
      changePct: ((price - previousClose) / previousClose) * 100,
      at: this.now(),
    };
  }

  async getProfile(symbol) {
    const instrument = find(symbol);
    if (!instrument) throw new NotFoundError(`No profile for ${symbol} in offline mode`);
    const { name, kind, sector, mktCap, peRatio, divYield } = instrument;
    return {
      symbol,
      name,
      kind,
      sector,
      exchange: symbol.endsWith('.TO') ? 'TSX' : 'DEMO',
      logo: null,
      mktCap,
      peRatio,
      divYield,
    };
  }
}

export class StaticHistoryProvider {
  constructor({ quotes = new StaticQuoteProvider(), now = () => Date.now() } = {}) {
    this.quotes = quotes;
    this.now = now;
    this.supportsIntraday = true;
  }

  async getPriceHistory(symbol, rangeId) {
    const quote = await this.quotes.getQuote(symbol);
    const range = rangeOf(rangeId);
    const count = 80;
    const random = seededRandom(hashString(symbol + rangeId));
    const volatility = Math.min(0.04, 0.002 + range.days / 40000);
    const steps = Array.from({ length: count }, () => 1 + (random() - 0.49) * 2 * volatility);
    const prices = new Array(count);
    prices[count - 1] = quote.priceCents;
    for (let i = count - 2; i >= 0; i--) prices[i] = Math.round(prices[i + 1] / steps[i + 1]);
    const spacing = (range.days * 86400000) / count;
    const end = this.now();
    return {
      symbol,
      range: rangeId,
      granularity: 'simulated',
      points: prices.map((priceCents, index) => ({ t: end - (count - 1 - index) * spacing, priceCents })),
    };
  }
}

export { POPULAR_SYMBOLS, SEED as STATIC_INSTRUMENTS };
