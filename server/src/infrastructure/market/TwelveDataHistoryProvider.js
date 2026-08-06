import { NotFoundError } from '../../domain/errors.js';
import { toCents } from '../../shared/money.js';
import { rangeOf } from './ranges.js';

const BASE_URL = 'https://api.twelvedata.com';

/**
 * Twelve Data adapter for price history. Its free tier includes intraday
 * intervals for US equities (8 credits/min, 800/day), which Finnhub's does not.
 */
export class TwelveDataHistoryProvider {
  constructor({ apiKey, fetchImpl = fetch.bind(globalThis) }) {
    this.apiKey = apiKey;
    this.fetch = fetchImpl;
    this.supportsIntraday = true;
  }

  async getPriceHistory(symbol, rangeId) {
    const { interval, outputsize } = rangeOf(rangeId).twelveData;
    const url = new URL(BASE_URL + '/time_series');
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('interval', interval);
    url.searchParams.set('outputsize', String(outputsize));
    url.searchParams.set('order', 'asc');
    url.searchParams.set('apikey', this.apiKey);

    const response = await this.fetch(url);
    if (response.status === 429) throw new Error('Twelve Data credit limit reached — try again shortly');
    if (!response.ok) throw new Error(`Twelve Data request failed: ${response.status}`);
    const data = await response.json();
    if (data.status === 'error' || !Array.isArray(data.values)) {
      throw new NotFoundError(data.message ?? `No history available for ${symbol}`);
    }
    return {
      symbol,
      range: rangeId,
      granularity: interval,
      points: data.values.map((row) => ({ t: Date.parse(row.datetime), priceCents: toCents(row.close) })),
    };
  }
}
