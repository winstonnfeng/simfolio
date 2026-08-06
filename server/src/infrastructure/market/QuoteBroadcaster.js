import { EventEmitter } from 'node:events';

/**
 * Fans one upstream price feed out to many browser connections.
 *
 * Symbols are reference-counted: the upstream stream is told to watch a symbol
 * when the first subscriber asks for it and to drop it when the last one leaves.
 * That keeps a vendor socket subscription list proportional to what users are
 * actually looking at, not to the size of the universe.
 */
export class QuoteBroadcaster extends EventEmitter {
  constructor({ stream }) {
    super();
    this.stream = stream;
    this.refCounts = new Map();
    this.latest = new Map();
    this.stream.onQuote((quote) => {
      this.latest.set(quote.symbol, quote);
      this.emit('quote', quote);
    });
  }

  /** @returns {() => void} unsubscribe */
  subscribe(symbols, listener) {
    const watched = [...new Set(symbols)];
    for (const symbol of watched) this._retain(symbol);

    const onQuote = (quote) => {
      if (watched.includes(quote.symbol)) listener(quote);
    };
    this.on('quote', onQuote);

    // Replay whatever is already known so a new connection paints immediately.
    for (const symbol of watched) {
      const cached = this.latest.get(symbol);
      if (cached) listener(cached);
    }

    return () => {
      this.off('quote', onQuote);
      for (const symbol of watched) this._release(symbol);
    };
  }

  _retain(symbol) {
    const next = (this.refCounts.get(symbol) ?? 0) + 1;
    this.refCounts.set(symbol, next);
    if (next === 1) this.stream.watch(symbol);
  }

  _release(symbol) {
    const next = (this.refCounts.get(symbol) ?? 1) - 1;
    if (next <= 0) {
      this.refCounts.delete(symbol);
      this.stream.unwatch(symbol);
    } else {
      this.refCounts.set(symbol, next);
    }
  }

  async close() {
    await this.stream.close();
    this.removeAllListeners();
  }
}
