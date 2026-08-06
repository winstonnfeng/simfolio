/**
 * TradingGateway — the single contract the ViewModel programs against.
 * Two adapters implement it: RemoteTradingGateway (the Express API) and
 * LocalTradingGateway (in-browser domain + localStorage). Because both return
 * identical shapes, no screen code changes when the backend comes online.
 *
 * All amounts crossing this boundary are dollars, matching the API presenters.
 *
 * @typedef {object} Session   { user: { id, name, email } }
 * @typedef {object} Quote     { symbol, price, change, changePct }
 * @typedef {object} Summary   { total, cash, invested, deposited, unrealized,
 *                               unrealizedPct, totalReturn, totalReturnPct, positions }
 * @typedef {object} Position  { symbol, qty, avgCost, price, value, unrealized, unrealizedPct }
 * @typedef {object} Txn       { id, type, symbol, qty, price, amount, realized, createdAt }
 *
 * @typedef {object} TradingGateway
 * @property {string} mode                                        'remote' | 'local'
 * @property {() => Promise<Session|null>} restoreSession
 * @property {(input: object) => Promise<Session>} register
 * @property {(input: object) => Promise<Session>} login
 * @property {() => Promise<void>} logout
 * @property {() => Promise<object[]>} listInstruments        popular list for the empty state
 * @property {(query: string) => Promise<object[]>} searchInstruments
 * @property {(symbol: string) => Promise<{instrument: object, quote: Quote|null}>} getInstrument
 * @property {() => Promise<Summary>} getPortfolio
 * @property {(order: object) => Promise<{execution: Txn, portfolio: Summary}>} placeOrder
 * @property {(amount: number) => Promise<{portfolio: Summary}>} deposit
 * @property {() => Promise<Txn[]>} listTransactions
 * @property {() => Promise<string[]>} getWatchlist
 * @property {(symbols: string[]) => Promise<string[]>} setWatchlist
 * @property {(symbol: string, range: string) => Promise<number[]>} getSeries
 * @property {(symbols: string[], onQuotes: Function) => Function} subscribeQuotes
 */
export const RANGE_IDS = ['1D', '1W', '1M', '3M', '1Y', '5Y'];
