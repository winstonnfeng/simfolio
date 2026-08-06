/**
 * Test doubles for every port. These exist because the production code depends
 * on interfaces rather than on concrete adapters — swapping Postgres for a Map
 * and Finnhub for a fixed price list is what the dependency inversion buys.
 */

export class InMemoryUserRepository {
  constructor() {
    this.rows = new Map();
  }

  async create(user) {
    this.rows.set(user.id, user);
    return user;
  }

  async findByEmail(email) {
    return [...this.rows.values()].find((user) => user.email === email) ?? null;
  }

  async findById(id) {
    return this.rows.get(id) ?? null;
  }
}

export class InMemoryPortfolioRepository {
  constructor() {
    this.portfolios = new Map();
    this.transactions = new Map();
  }

  async create(userId, portfolio) {
    this.portfolios.set(userId, portfolio);
    this.transactions.set(userId, []);
    return portfolio;
  }

  async findByUserId(userId) {
    return this.portfolios.get(userId) ?? null;
  }

  async applyTrade(userId, portfolio, transaction) {
    this.portfolios.set(userId, portfolio);
    this.transactions.get(userId).unshift(transaction);
    return portfolio;
  }

  async listTransactions(userId, limit = 100) {
    return (this.transactions.get(userId) ?? []).slice(0, limit);
  }
}

export class InMemoryWatchlistRepository {
  constructor() {
    this.rows = new Map();
  }

  async list(userId) {
    return this.rows.get(userId) ?? [];
  }

  async replace(userId, symbols) {
    this.rows.set(userId, symbols);
    return symbols;
  }
}

/** MarketData port with fixed prices — no network, no clock, no cache. */
export class StubMarketData {
  constructor(pricesBySymbol = {}) {
    this.prices = pricesBySymbol;
    this.quoteCalls = 0;
  }

  async getQuote(symbol) {
    this.quoteCalls += 1;
    const priceCents = this.prices[symbol];
    if (priceCents === undefined) throw new Error(`No stub price for ${symbol}`);
    return { symbol, priceCents, previousCloseCents: priceCents };
  }

  async getQuotes(symbols) {
    const entries = await Promise.all(symbols.map(async (symbol) => [symbol, await this.getQuote(symbol)]));
    return Object.fromEntries(entries);
  }
}

/** Reversible stand-in for bcrypt: same contract, instant. */
export const fakeHasher = {
  async hash(plain) {
    return `hashed:${plain}`;
  },
  async verify(plain, hash) {
    return hash === `hashed:${plain}`;
  },
};

export const fakeTokens = {
  sign({ sub }) {
    return `token:${sub}`;
  },
  verify(token) {
    if (!String(token).startsWith('token:')) throw new Error('bad token');
    return { sub: String(token).slice('token:'.length) };
  },
};

/** Predictable ids, so assertions can name them. */
export class SequentialIds {
  constructor(prefix = 'id') {
    this.prefix = prefix;
    this.n = 0;
  }

  next() {
    this.n += 1;
    return `${this.prefix}-${this.n}`;
  }
}

export const silentLogger = { log() {}, warn() {}, error() {} };
