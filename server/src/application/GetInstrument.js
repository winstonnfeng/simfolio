import { normalizeSymbol } from '../domain/Symbol.js';

export class GetInstrument {
  constructor({ marketData }) {
    this.marketData = marketData;
  }

  async execute({ symbol }) {
    const ticker = normalizeSymbol(symbol);
    const [instrument, quote] = await Promise.all([
      this.marketData.getInstrument(ticker),
      // A missing quote must not hide the profile — the detail screen renders
      // fundamentals even when the price feed is rate-limited.
      this.marketData.getQuote(ticker).catch(() => null),
    ]);
    return { instrument, quote };
  }
}
