/**
 * Pulls the tradable universe from the quote provider into the local symbol
 * table. Run at boot and at most once per interval; search then costs no quota.
 */
export class RefreshSymbolUniverse {
  constructor({ symbols, marketData, clock, maxAgeMs = 86_400_000 }) {
    this.symbols = symbols;
    this.marketData = marketData;
    this.clock = clock;
    this.maxAgeMs = maxAgeMs;
  }

  async executeIfStale() {
    const [count, refreshedAt] = await Promise.all([this.symbols.count(), this.symbols.lastRefreshedAt()]);
    const fresh = count > 0 && this.clock.now() - Number(refreshedAt) < this.maxAgeMs;
    if (fresh) return { refreshed: false, count };

    const instruments = await this.marketData.listSymbols();
    return { refreshed: true, count: await this.symbols.replaceAll(instruments) };
  }
}
