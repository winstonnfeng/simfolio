import WebSocket from 'ws';
import { toCents } from '../../shared/money.js';

const ENDPOINT = 'wss://ws.finnhub.io';
const MAX_BACKOFF_MS = 30_000;

/**
 * QuoteStream over Finnhub's WebSocket trade feed. Prices arrive as trades, so
 * they are throttled to one update per symbol per `throttleMs` — a liquid name
 * can print hundreds of trades a second and the UI cannot use them.
 *
 * Reconnects with exponential backoff and re-subscribes the watched set, so a
 * dropped socket is invisible to browsers downstream.
 *
 * Dependencies are two narrow ports rather than the whole MarketData facade:
 * `quotes` to seed a first price, `snapshots` to read a previous close without
 * provoking a fetch. WebSocketImpl and clock are injected so this is testable
 * without a network.
 */
export class FinnhubSocketQuoteStream {
  constructor({ apiKey, quotes, snapshots, clock, throttleMs = 1000, WebSocketImpl = WebSocket, logger = console }) {
    this.apiKey = apiKey;
    this.quotes = quotes;
    this.snapshots = snapshots;
    this.clock = clock;
    this.throttleMs = throttleMs;
    this.WebSocketImpl = WebSocketImpl;
    this.logger = logger;
    this.watched = new Set();
    this.lastEmitted = new Map();
    this.listeners = new Set();
    this.socket = null;
    this.reconnectAttempts = 0;
    this.closed = false;
  }

  onQuote(listener) {
    this.listeners.add(listener);
  }

  _emit(quote) {
    for (const listener of this.listeners) listener(quote);
  }

  _send(message) {
    if (this.socket?.readyState === 1) this.socket.send(JSON.stringify(message));
  }

  _connect() {
    if (this.closed || this.socket) return;
    const socket = new this.WebSocketImpl(`${ENDPOINT}?token=${this.apiKey}`);
    this.socket = socket;

    socket.on('open', () => {
      this.reconnectAttempts = 0;
      for (const symbol of this.watched) this._send({ type: 'subscribe', symbol });
    });

    socket.on('message', (raw) => this._handleMessage(raw));

    socket.on('close', () => {
      this.socket = null;
      this._scheduleReconnect();
    });

    socket.on('error', (error) => {
      this.logger.warn('[quote-stream] socket error —', error.message);
      socket.close();
    });
  }

  _handleMessage(raw) {
    let payload;
    try {
      payload = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (payload.type !== 'trade' || !Array.isArray(payload.data)) return;
    for (const trade of payload.data) this._handleTrade(trade);
  }

  _handleTrade({ s: symbol, p: price, t: tradeAt }) {
    if (!symbol || typeof price !== 'number') return;

    const now = this.clock.now();
    if (now - (this.lastEmitted.get(symbol) ?? 0) < this.throttleMs) return;
    this.lastEmitted.set(symbol, now);

    // The socket carries no previous close; take it from the cached REST quote
    // so the day-change figure stays consistent with the rest of the app.
    const priceCents = toCents(price);
    const previousCloseCents = this.snapshots.peek(symbol)?.previousCloseCents ?? priceCents;
    const changeCents = priceCents - previousCloseCents;

    this._emit({
      symbol,
      priceCents,
      previousCloseCents,
      changeCents,
      changePct: previousCloseCents ? (changeCents / previousCloseCents) * 100 : 0,
      at: tradeAt ?? now,
    });
  }

  _scheduleReconnect() {
    if (this.closed || this.watched.size === 0) return;
    const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** this.reconnectAttempts++);
    setTimeout(() => this._connect(), delay).unref?.();
  }

  watch(symbol) {
    if (this.watched.has(symbol)) return;
    this.watched.add(symbol);
    this._connect();
    // Seed a REST quote so the first paint does not wait for a trade to print.
    this.quotes
      .getQuote(symbol)
      .then((quote) => this._emit(quote))
      .catch(() => {});
    this._send({ type: 'subscribe', symbol });
  }

  unwatch(symbol) {
    if (!this.watched.delete(symbol)) return;
    this.lastEmitted.delete(symbol);
    this._send({ type: 'unsubscribe', symbol });
  }

  async close() {
    this.closed = true;
    this.watched.clear();
    this.listeners.clear();
    this.socket?.close();
    this.socket = null;
  }
}
