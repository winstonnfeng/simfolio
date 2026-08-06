/**
 * QuoteStream that polls the REST port on an interval. Used when no
 * WebSocket-capable vendor key is configured, and in offline mode. Same
 * interface as the socket stream, so nothing downstream changes.
 *
 * @param {{ quotes: import('../../domain/ports.js').MarketData }} deps
 */
export class PollingQuoteStream {
  constructor({ quotes, intervalMs = 4000 }) {
    this.quotes = quotes;
    this.intervalMs = intervalMs;
    this.watched = new Set();
    this.listeners = new Set();
    this.timer = null;
  }

  onQuote(listener) {
    this.listeners.add(listener);
  }

  watch(symbol) {
    this.watched.add(symbol);
    this._start();
    this._pollOnce([symbol]).catch(() => {});
  }

  unwatch(symbol) {
    this.watched.delete(symbol);
    if (this.watched.size === 0) this._stop();
  }

  async _pollOnce(symbols) {
    const quotes = await this.quotes.getQuotes(symbols);
    for (const quote of Object.values(quotes)) {
      for (const listener of this.listeners) listener(quote);
    }
  }

  _start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      if (this.watched.size > 0) this._pollOnce([...this.watched]).catch(() => {});
    }, this.intervalMs);
    this.timer.unref?.();
  }

  _stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async close() {
    this._stop();
    this.listeners.clear();
    this.watched.clear();
  }
}
