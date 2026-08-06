/**
 * Ports: the interfaces the domain and application layers depend on. Adapters
 * in src/infrastructure/** must satisfy these shapes. They are JSDoc typedefs
 * because the runtime is plain JS, but they are the contract — the composition
 * root is the only place allowed to know which concrete class backs each one.
 *
 * @typedef {object} Clock
 * @property {() => number} now
 *
 * @typedef {object} IdFactory
 * @property {() => string} next
 *
 * @typedef {object} UserRepository
 * @property {(user: object) => Promise<object>} create
 * @property {(email: string) => Promise<object|null>} findByEmail
 * @property {(id: string) => Promise<object|null>} findById
 *
 * @typedef {object} PortfolioRepository
 * @property {(userId: string) => Promise<object|null>} findByUserId
 * @property {(userId: string, portfolio: object) => Promise<object>} create
 * @property {(userId: string, portfolio: object, transaction: object) => Promise<object>} applyTrade
 * @property {(userId: string, limit?: number) => Promise<object[]>} listTransactions
 *
 * @typedef {object} WatchlistRepository
 * @property {(userId: string) => Promise<string[]>} list
 * @property {(userId: string, symbols: string[]) => Promise<string[]>} replace
 *
 * @typedef {object} SymbolRepository
 * @property {() => Promise<number>} count
 * @property {() => Promise<number>} lastRefreshedAt
 * @property {(instruments: object[]) => Promise<number>} replaceAll
 * @property {(symbol: string) => Promise<boolean>} has
 * @property {(symbols: string[]) => Promise<object[]>} findMany
 * @property {(query: string, limit?: number) => Promise<object[]>} search
 *
 * @typedef {object} SqlDatabase
 * @property {(sql: string, params?: any[]) => Promise<{rows: object[]}>} query
 * @property {(work: (client: object) => Promise<any>) => Promise<any>} transaction
 * @property {() => Promise<void>} close
 *
 * @typedef {object} QuoteProvider
 * @property {() => Promise<object[]>} listSymbols
 * @property {(query: string) => Promise<object[]>} searchSymbols
 * @property {(symbol: string) => Promise<{symbol: string, priceCents: number, previousCloseCents: number}>} getQuote
 * @property {(symbol: string) => Promise<object>} getProfile
 *
 * @typedef {object} HistoryProvider
 * @property {boolean} supportsIntraday
 * @property {(symbol: string, range: string) => Promise<{range: string, points: Array<{t: number, priceCents: number}>}>} getPriceHistory
 *
 * MarketData is the single port the application layer uses for prices. Both the
 * plain composer and the caching decorator implement it, so a use case cannot
 * tell whether a quote was cached.
 *
 * @typedef {object} MarketData
 * @property {(symbol: string) => Promise<object>} getQuote
 * @property {(symbols: string[]) => Promise<Record<string, object>>} getQuotes
 * @property {(symbol: string, range: string) => Promise<object>} getPriceHistory
 * @property {(symbol: string) => Promise<object>} getInstrument
 * @property {(query: string) => Promise<object[]>} searchInstruments
 * @property {() => Promise<object[]>} listPopular
 * @property {() => Promise<object[]>} listSymbols
 *
 * A narrow read-only view of already-known prices. The socket stream needs
 * yesterday's close to compute a day change and must never trigger a fetch to
 * get it, so it depends on this rather than on all of MarketData.
 *
 * @typedef {object} QuoteSnapshots
 * @property {(symbol: string) => object|null} peek
 *
 * @typedef {object} QuoteStream
 * @property {(listener: (quote: object) => void) => void} onQuote
 * @property {(symbol: string) => void} watch
 * @property {(symbol: string) => void} unwatch
 * @property {() => Promise<void>} close
 *
 * @typedef {object} PasswordHasher
 * @property {(plain: string) => Promise<string>} hash
 * @property {(plain: string, hash: string) => Promise<boolean>} verify
 *
 * @typedef {object} TokenService
 * @property {(payload: object) => string} sign
 * @property {(token: string) => object} verify
 */
export {};
