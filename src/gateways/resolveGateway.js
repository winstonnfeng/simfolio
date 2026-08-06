import { LocalTradingGateway } from './LocalTradingGateway.js';
import { RemoteTradingGateway } from './RemoteTradingGateway.js';

const DEFAULT_BASE_URL = 'http://localhost:4000';

/**
 * Chooses an adapter at boot: the API when /health answers, otherwise the
 * in-browser gateway. Lets the same build run as an offline prototype and as
 * a real client without a flag to flip.
 */
export async function resolveGateway({ baseUrl = DEFAULT_BASE_URL, startingCash, livePrices, tokens } = {}) {
  if (await RemoteTradingGateway.probe(baseUrl)) return new RemoteTradingGateway({ baseUrl, tokens });
  return new LocalTradingGateway({ startingCash, livePrices });
}
