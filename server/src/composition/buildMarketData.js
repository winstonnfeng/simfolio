import { FinnhubQuoteProvider } from '../infrastructure/market/FinnhubQuoteProvider.js';
import { TwelveDataHistoryProvider } from '../infrastructure/market/TwelveDataHistoryProvider.js';
import { StooqHistoryProvider } from '../infrastructure/market/StooqHistoryProvider.js';
import { StaticQuoteProvider, StaticHistoryProvider } from '../infrastructure/market/StaticMarketProviders.js';
import { MarketDataService } from '../infrastructure/market/MarketDataService.js';
import { CachingMarketData } from '../infrastructure/market/CachingMarketData.js';
import { QuoteBroadcaster } from '../infrastructure/market/QuoteBroadcaster.js';
import { PollingQuoteStream } from '../infrastructure/market/PollingQuoteStream.js';

const QUOTE_PROVIDERS = {
  finnhub: (config) => new FinnhubQuoteProvider({ apiKey: config.market.finnhubApiKey }),
  static: () => new StaticQuoteProvider(),
};

const HISTORY_PROVIDERS = {
  twelvedata: (config) => new TwelveDataHistoryProvider({ apiKey: config.market.twelveDataApiKey }),
  stooq: () => new StooqHistoryProvider(),
  static: (_config, quotes) => new StaticHistoryProvider({ quotes }),
};

async function buildQuoteStream({ config, marketData, clock }) {
  if (config.market.streamProvider === 'finnhub-socket') {
    const { FinnhubSocketQuoteStream } = await import('../infrastructure/market/FinnhubSocketQuoteStream.js');
    return new FinnhubSocketQuoteStream({
      apiKey: config.market.finnhubApiKey,
      quotes: marketData,
      snapshots: marketData,
      clock,
      throttleMs: config.market.streamThrottleMs,
    });
  }
  return new PollingQuoteStream({ quotes: marketData, intervalMs: config.market.streamIntervalMs });
}

/**
 * Vendors are selected from config by name, then composed and wrapped: raw
 * providers -> MarketDataService (composition) -> CachingMarketData (caching).
 * The application layer only ever sees the outermost object, and only ever as
 * the MarketData port.
 */
export async function buildMarketData({ config, symbols, clock }) {
  const quoteProvider = QUOTE_PROVIDERS[config.market.quoteProvider](config);
  const historyProvider = HISTORY_PROVIDERS[config.market.historyProvider](config, quoteProvider);

  const marketData = new CachingMarketData({
    inner: new MarketDataService({ quotes: quoteProvider, history: historyProvider, symbols }),
    clock,
    ttls: {
      quote: config.market.quoteCacheTtlMs,
      profile: config.market.profileCacheTtlMs,
      history: config.market.historyCacheTtlMs,
      search: config.market.searchCacheTtlMs,
    },
  });

  const broadcaster = new QuoteBroadcaster({ stream: await buildQuoteStream({ config, marketData, clock }) });
  return { marketData, broadcaster };
}
