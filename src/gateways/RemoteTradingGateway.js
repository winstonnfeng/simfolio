import { HttpClient } from '../api/HttpClient.js';
import { LocalTokenStore } from '../api/tokenStorage.js';

/**
 * TradingGateway backed by the Express API.
 *
 * Everything it needs from the outside world arrives through the constructor:
 * the base URL, the HTTP client, and the token store. Nothing here reads a
 * global, so the whole adapter is testable against a stub fetch.
 */
export class RemoteTradingGateway {
  constructor({ baseUrl, pollMs = 6000, tokens = new LocalTokenStore() }) {
    this.mode = 'remote';
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.pollMs = pollMs;
    this.tokens = tokens;
    this.http = new HttpClient({ baseUrl, getToken: () => this.tokens.read() });
  }

  static async probe(baseUrl, timeoutMs = 1200) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/health`, { signal: controller.signal });
      return response.ok;
    } catch (error) {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  async restoreSession() {
    if (!this.tokens.read()) return null;
    try {
      const { user } = await this.http.get('/api/auth/me');
      return { user };
    } catch (error) {
      this.tokens.clear();
      return null;
    }
  }

  async register(input) {
    const { user, token } = await this.http.post('/api/auth/register', input);
    this.tokens.write(token);
    return { user };
  }

  async login(input) {
    const { user, token } = await this.http.post('/api/auth/login', input);
    this.tokens.write(token);
    return { user };
  }

  async logout() {
    this.tokens.clear();
  }

  async listInstruments() {
    const { instruments } = await this.http.get('/api/market/instruments');
    return instruments;
  }

  async searchInstruments(query) {
    const { results } = await this.http.get(`/api/market/search?q=${encodeURIComponent(query)}`);
    return results;
  }

  async getInstrument(symbol) {
    return this.http.get(`/api/market/instruments/${encodeURIComponent(symbol)}`);
  }

  async getPortfolio() {
    const { portfolio } = await this.http.get('/api/portfolio');
    return portfolio;
  }

  async placeOrder({ side, symbol, qty }) {
    return this.http.post('/api/orders', { side, symbol, qty });
  }

  async deposit(amount) {
    return this.http.post('/api/cash/deposits', { amount });
  }

  async listTransactions() {
    const { transactions } = await this.http.get('/api/transactions?limit=200');
    return transactions;
  }

  async getWatchlist() {
    const { symbols } = await this.http.get('/api/watchlist');
    return symbols;
  }

  async setWatchlist(symbols) {
    const result = await this.http.put('/api/watchlist', { symbols });
    return result.symbols;
  }

  /** Closing prices only — the chart is a line, not candles. */
  async getSeries(symbol, range) {
    const { history } = await this.http.get(`/api/market/history/${encodeURIComponent(symbol)}?range=${range}`);
    return history.points.map((point) => point.price);
  }

  /**
   * Live quotes over server-sent events, falling back to polling where
   * EventSource is unavailable. The server relays one upstream vendor socket to
   * every connection, so this costs one HTTP stream per browser tab.
   */
  subscribeQuotes(symbols, onQuotes) {
    if (symbols.length === 0) return () => {};
    if (typeof EventSource === 'undefined') return this._pollQuotes(symbols, onQuotes);

    const query = new URLSearchParams({ symbols: symbols.join(','), token: this.tokens.read() ?? '' });
    const source = new EventSource(`${this.baseUrl}/api/stream/quotes?${query}`);

    source.addEventListener('quote', (event) => {
      try {
        const quote = JSON.parse(event.data);
        onQuotes({ [quote.symbol]: quote });
      } catch (error) {
        /* ignore a malformed frame */
      }
    });

    // EventSource reconnects on its own; only a hard failure needs the fallback.
    let fallback = null;
    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED && !fallback) {
        fallback = this._pollQuotes(symbols, onQuotes);
      }
    };

    return () => {
      source.close();
      if (fallback) fallback();
    };
  }

  /** Batched polling fallback: one request per tick for the whole symbol set. */
  _pollQuotes(symbols, onQuotes) {
    let stopped = false;
    let timer = null;
    const poll = async () => {
      if (stopped) return;
      try {
        const { quotes } = await this.http.get(`/api/market/quotes?symbols=${symbols.join(',')}`);
        if (!stopped) onQuotes(quotes);
      } catch (error) {
        /* a dropped poll is not fatal — the next tick retries */
      }
      if (!stopped) timer = setTimeout(poll, this.pollMs);
    };
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }
}
