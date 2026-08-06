import { NotFoundError } from '../../domain/errors.js';
import { toCents } from '../../shared/money.js';

const BASE_URL = 'https://finnhub.io/api/v1';

/**
 * Finnhub exchange codes for the markets this app trades. Canadian listings come
 * back suffixed (SHOP.TO, WELL.V), which is also how they must be quoted — the
 * suffix is part of the ticker, not decoration.
 */
const DEFAULT_EXCHANGES = [
  { code: 'US', market: 'US' },
  { code: 'TO', market: 'CA' },
  { code: 'V', market: 'CA' },
];

const CANADIAN_SUFFIX = /\.(TO|V|NE|CN)$/;
const TRADABLE_TICKER = /^[A-Z0-9]{1,6}(\.[A-Z]{1,2})?$/;

/**
 * Finnhub adapter for everything its free tier covers: real-time quotes,
 * symbol search, the symbol universe, company profiles and metrics. Historical
 * candles are premium there, so they come from a HistoryProvider.
 */
export class FinnhubQuoteProvider {
  constructor({ apiKey, fetchImpl = fetch.bind(globalThis), exchanges = DEFAULT_EXCHANGES, logger = console }) {
    this.apiKey = apiKey;
    this.fetch = fetchImpl;
    this.exchanges = exchanges;
    this.logger = logger;
  }

  async _get(path, params = {}) {
    const url = new URL(BASE_URL + path);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
    url.searchParams.set('token', this.apiKey);
    const response = await this.fetch(url);
    if (response.status === 429) throw new Error('Finnhub rate limit reached — try again in a minute');
    if (response.status === 401 || response.status === 403) {
      throw new Error('Finnhub rejected the API key or the endpoint is premium-only');
    }
    if (!response.ok) throw new Error(`Finnhub request failed: ${response.status}`);
    return response.json();
  }

  /**
   * The tradable universe, used to build the searchable symbol table. Fetched
   * one exchange at a time so a single request never blows the free-tier rate
   * limit, and an exchange that refuses is skipped rather than fatal: the free
   * tier serves the US list but charges for TSX, and a US-only universe beats
   * no universe at all. Search still reaches Canadian listings, because
   * /search is not exchange-gated.
   */
  async listSymbols() {
    const universe = new Map();
    const skipped = [];

    for (const exchange of this.exchanges) {
      try {
        const rows = await this._get('/stock/symbol', { exchange: exchange.code });
        for (const instrument of this._toInstruments(rows, exchange)) {
          if (!universe.has(instrument.symbol)) universe.set(instrument.symbol, instrument);
        }
      } catch (error) {
        skipped.push(`${exchange.code} (${error.message})`);
      }
    }

    if (universe.size === 0) throw new Error(`No exchange could be listed — ${skipped.join('; ')}`);
    if (skipped.length > 0) this.logger.warn(`[finnhub] skipped: ${skipped.join('; ')}`);
    return [...universe.values()];
  }

  _toInstruments(rows, exchange) {
    return (rows ?? [])
      .filter((row) => row.symbol && row.type !== 'Bond' && TRADABLE_TICKER.test(row.symbol))
      .map((row) => ({
        symbol: row.symbol,
        name: row.description ?? row.symbol,
        kind: row.type === 'ETP' ? 'ETF' : 'Stock',
        exchange: row.mic ?? exchange.code,
        market: exchange.market,
      }));
  }

  /**
   * Search runs unscoped and is filtered down to North America afterwards — one
   * request covers both countries, and a user typing "shopify" sees SHOP and
   * SHOP.TO side by side rather than having to know which listing to ask for.
   */
  async searchSymbols(query) {
    const data = await this._get('/search', { q: query });
    return (data.result ?? [])
      .filter((row) => row.symbol && TRADABLE_TICKER.test(row.symbol) && this._isNorthAmerican(row.symbol))
      .slice(0, 14)
      .map((row) => ({
        symbol: row.symbol,
        name: row.description ?? row.symbol,
        kind: row.type === 'ETP' ? 'ETF' : 'Stock',
        market: CANADIAN_SUFFIX.test(row.symbol) ? 'CA' : 'US',
      }));
  }

  /** US tickers carry no suffix; anything else must be a market we trade. */
  _isNorthAmerican(symbol) {
    return !symbol.includes('.') || CANADIAN_SUFFIX.test(symbol);
  }

  async getQuote(symbol) {
    const data = await this._get('/quote', { symbol });
    if (!data || typeof data.c !== 'number' || data.c === 0) {
      throw new NotFoundError(`No live quote available for ${symbol}`);
    }
    return {
      symbol,
      priceCents: toCents(data.c),
      previousCloseCents: toCents(data.pc || data.c),
      changeCents: toCents(data.d ?? 0),
      changePct: data.dp ?? 0,
      at: (data.t ?? Math.floor(Date.now() / 1000)) * 1000,
    };
  }

  /** Profile plus the handful of metrics the stock page shows. */
  async getProfile(symbol) {
    const [profile, metrics] = await Promise.all([
      this._get('/stock/profile2', { symbol }),
      this._get('/stock/metric', { symbol, metric: 'all' }).catch(() => ({ metric: {} })),
    ]);
    if (!profile || !profile.name) throw new NotFoundError(`No company profile for ${symbol}`);
    const metric = metrics.metric ?? {};
    return {
      symbol,
      name: profile.name,
      kind: profile.type === 'ETP' ? 'ETF' : 'Stock',
      sector: profile.finnhubIndustry ?? profile.exchange ?? (CANADIAN_SUFFIX.test(symbol) ? 'Canada listed' : 'US listed'),
      exchange: profile.exchange ?? null,
      logo: profile.logo || null,
      mktCap: profile.marketCapitalization ? profile.marketCapitalization * 1e6 : null,
      peRatio: metric.peBasicExclExtraTTM ?? metric.peTTM ?? null,
      divYield: metric.dividendYieldIndicatedAnnual ?? 0,
      weekHigh52: metric['52WeekHigh'] ?? null,
      weekLow52: metric['52WeekLow'] ?? null,
    };
  }
}
