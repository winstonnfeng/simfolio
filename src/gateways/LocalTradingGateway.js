import * as accounts from '../accounts.js';
import * as domain from '../portfolio.js';
import { INSTRUMENTS, PriceFeed, buildSeries, findInstrument } from '../marketData.js';

const DEMO = { name: 'Amanda Chen', email: 'demo@paper.app', password: 'demo123' };
const DEFAULT_WATCHLIST = ['NVDA', 'VOO', 'TSLA', 'KO', 'QQQ'];

/**
 * TradingGateway backed by the in-browser domain and localStorage. Keeps the
 * prototype fully usable with no server running, and mirrors the API response
 * shapes exactly so the ViewModel cannot tell the difference.
 */
export class LocalTradingGateway {
  constructor({ startingCash = domain.DEFAULT_STARTING_CASH, livePrices = true } = {}) {
    this.mode = 'local';
    this.startingCash = startingCash;
    this.feed = new PriceFeed();
    if (livePrices) this.feed.start();
    this.session = null;
    this._seedDemoAccount();
  }

  destroy() {
    this.feed.stop();
  }

  // ---- internals ---------------------------------------------------------

  _seedDemoAccount() {
    accounts.register(DEMO);
    if (accounts.loadPortfolio(DEMO.email)) return;
    let portfolio = domain.createPortfolio(this.startingCash);
    for (const [symbol, qty, price] of [
      ['AAPL', 60, 198.4],
      ['VOO', 40, 468.12],
      ['NVDA', 120, 96.55],
      ['COST', 8, 792.3],
      ['SCHD', 150, 76.44],
    ]) {
      const result = domain.buy(portfolio, symbol, qty, price);
      if (result.ok) portfolio = result.portfolio;
    }
    accounts.savePortfolio(DEMO.email, portfolio);
  }

  _requireSession() {
    if (!this.session) throw new Error('Not signed in');
    return this.session;
  }

  _read() {
    const { email } = this._requireSession();
    return accounts.loadPortfolio(email) ?? domain.createPortfolio(this.startingCash);
  }

  _write(portfolio) {
    accounts.savePortfolio(this._requireSession().email, portfolio);
    return this._present(portfolio);
  }

  /** Maps the local domain summary onto the API's portfolio payload. */
  _present(portfolio) {
    const summary = domain.summarize(portfolio, this.feed.prices);
    const round = (value) => Math.round(value * 100) / 100;
    return {
      total: round(summary.total),
      cash: round(summary.cash),
      invested: round(summary.invested),
      deposited: round(portfolio.deposited),
      unrealized: round(summary.unrealized),
      unrealizedPct: round(summary.unrealizedPct),
      totalReturn: round(summary.returnAbs),
      totalReturnPct: round(summary.returnPct),
      positions: summary.positions.map((position) => ({
        symbol: position.symbol,
        qty: position.qty,
        avgCost: round(position.avgCost),
        price: round(position.price),
        value: round(position.value),
        unrealized: round(position.pl),
        unrealizedPct: round(position.plPct),
      })),
    };
  }

  _presentTransaction(transaction) {
    return {
      id: transaction.id,
      type: transaction.type,
      symbol: transaction.symbol ?? null,
      qty: transaction.qty ?? null,
      price: transaction.price ?? null,
      amount: transaction.amount,
      realized: transaction.realized ?? 0,
      createdAt: transaction.at,
    };
  }

  // ---- gateway contract --------------------------------------------------

  async restoreSession() {
    const user = accounts.currentSession();
    if (!user) return null;
    this.session = user;
    return { user };
  }

  async register(input) {
    const result = accounts.register(input);
    if (!result.ok) throw new Error(result.error);
    accounts.savePortfolio(result.user.email, domain.createPortfolio(this.startingCash));
    accounts.saveWatchlist(result.user.email, DEFAULT_WATCHLIST);
    accounts.saveSession(result.user);
    this.session = result.user;
    return { user: result.user };
  }

  async login(input) {
    const result = accounts.login(input);
    if (!result.ok) throw new Error(result.error);
    accounts.saveSession(result.user);
    this.session = result.user;
    return { user: result.user };
  }

  async logout() {
    accounts.clearSession();
    this.session = null;
  }

  async listInstruments() {
    return INSTRUMENTS.map(({ symbol, name, kind, sector, mktCap, peRatio, divYield, price }) => ({
      symbol,
      name,
      kind,
      sector,
      mktCap,
      peRatio,
      divYield,
      referencePrice: price,
    }));
  }

  async searchInstruments(query) {
    const needle = query.trim().toUpperCase();
    const all = await this.listInstruments();
    return all.filter((item) => item.symbol.includes(needle) || item.name.toUpperCase().includes(needle)).slice(0, 8);
  }

  async getInstrument(symbol) {
    const instrument = (await this.listInstruments()).find((item) => item.symbol === symbol) ?? { symbol, name: symbol };
    const change = this.feed.dayChange(symbol);
    const price = this.feed.prices[symbol] ?? instrument.referencePrice ?? 0;
    return { instrument, quote: { symbol, price, change: change.abs, changePct: change.pct } };
  }

  async getPortfolio() {
    return this._present(this._read());
  }

  async placeOrder({ side, symbol, qty }) {
    const price = this.feed.prices[symbol] ?? findInstrument(symbol)?.price;
    const portfolio = this._read();
    const result = side === 'buy' ? domain.buy(portfolio, symbol, qty, price) : domain.sell(portfolio, symbol, qty, price);
    if (!result.ok) throw new Error(result.error);
    return {
      execution: this._presentTransaction(result.portfolio.transactions[0]),
      portfolio: this._write(result.portfolio),
    };
  }

  async deposit(amount) {
    const result = domain.deposit(this._read(), amount);
    if (!result.ok) throw new Error(result.error);
    return {
      transaction: this._presentTransaction(result.portfolio.transactions[0]),
      portfolio: this._write(result.portfolio),
    };
  }

  async listTransactions() {
    return this._read().transactions.map((transaction) => this._presentTransaction(transaction));
  }

  async getWatchlist() {
    return accounts.loadWatchlist(this._requireSession().email, DEFAULT_WATCHLIST);
  }

  async setWatchlist(symbols) {
    accounts.saveWatchlist(this._requireSession().email, symbols);
    return symbols;
  }

  async getSeries(symbol, range) {
    const endPrice = this.feed.prices[symbol] ?? findInstrument(symbol)?.price ?? 100;
    return buildSeries(symbol, range, endPrice);
  }

  subscribeQuotes(symbols, onQuotes) {
    return this.feed.subscribe((prices) => {
      const quotes = {};
      for (const symbol of Object.keys(prices)) {
        const change = this.feed.dayChange(symbol);
        quotes[symbol] = { symbol, price: prices[symbol], change: change.abs, changePct: change.pct };
      }
      onQuotes(quotes);
    });
  }
}
