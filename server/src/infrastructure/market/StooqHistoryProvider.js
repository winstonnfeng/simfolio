import { NotFoundError } from '../../domain/errors.js';
import { toCents } from '../../shared/money.js';
import { rangeOf } from './ranges.js';

/**
 * Keyless fallback for price history: Stooq's daily CSV export. No account and
 * no rate limit, but daily granularity only — short ranges therefore return
 * fewer points. Set TWELVEDATA_API_KEY for intraday charts.
 */
export class StooqHistoryProvider {
  constructor({ fetchImpl = fetch.bind(globalThis) } = {}) {
    this.fetch = fetchImpl;
    this.supportsIntraday = false;
  }

  async getPriceHistory(symbol, rangeId) {
    const range = rangeOf(rangeId);
    const url = `https://stooq.com/q/d/l/?s=${symbol.toLowerCase()}.us&i=d`;
    const response = await this.fetch(url);
    if (!response.ok) throw new Error(`Stooq request failed: ${response.status}`);
    const csv = await response.text();
    const rows = csv.trim().split('\n').slice(1);
    if (rows.length === 0 || csv.includes('Exceeded')) throw new NotFoundError(`No history available for ${symbol}`);

    const cutoff = Date.now() - range.days * 86400000;
    const points = rows
      .map((line) => line.split(','))
      .filter((cells) => cells.length >= 5)
      .map((cells) => ({ t: Date.parse(cells[0]), priceCents: toCents(cells[4]) }))
      .filter((point) => Number.isFinite(point.t) && point.priceCents > 0 && point.t >= cutoff);

    // Very short ranges have too few daily bars to plot — widen to the last 10 sessions.
    const series = points.length >= 2 ? points : rows.slice(-10).map((line) => {
      const cells = line.split(',');
      return { t: Date.parse(cells[0]), priceCents: toCents(cells[4]) };
    });
    if (series.length < 2) throw new NotFoundError(`No history available for ${symbol}`);
    return { symbol, range: rangeId, granularity: '1day', points: series };
  }
}
