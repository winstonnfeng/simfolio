import { RegisterUser } from '../application/RegisterUser.js';
import { LoginUser } from '../application/LoginUser.js';
import { GetPortfolio } from '../application/GetPortfolio.js';
import { PlaceOrder } from '../application/PlaceOrder.js';
import { DepositCash } from '../application/DepositCash.js';
import { ListTransactions } from '../application/ListTransactions.js';
import { GetMarketData } from '../application/GetMarketData.js';
import { SearchInstruments } from '../application/SearchInstruments.js';
import { GetInstrument } from '../application/GetInstrument.js';
import { RefreshSymbolUniverse } from '../application/RefreshSymbolUniverse.js';
import { ManageWatchlist } from '../application/ManageWatchlist.js';
import { PortfolioService } from '../application/services/PortfolioService.js';

/**
 * Every use case receives its collaborators here and nowhere else. Each one is
 * constructible in a test with fakes, because none of them reaches for a
 * module-level singleton.
 */
export function buildUseCases({ config, repositories, security, marketData, clock }) {
  const { users, portfolios, watchlists, symbols } = repositories;
  const portfolioService = new PortfolioService({ portfolios, marketData });

  return {
    registerUser: new RegisterUser({
      users,
      portfolios,
      passwordHasher: security.passwordHasher,
      tokens: security.tokens,
      ids: security.ids,
      clock,
      startingCashCents: config.trading.startingCashCents,
    }),
    loginUser: new LoginUser({ users, passwordHasher: security.passwordHasher, tokens: security.tokens }),
    getPortfolio: new GetPortfolio({ portfolioService }),
    placeOrder: new PlaceOrder({ portfolioService, marketData, clock }),
    depositCash: new DepositCash({ portfolioService, clock }),
    listTransactions: new ListTransactions({ portfolios }),
    getMarketData: new GetMarketData({ marketData }),
    searchInstruments: new SearchInstruments({ marketData }),
    getInstrument: new GetInstrument({ marketData }),
    manageWatchlist: new ManageWatchlist({ watchlists }),
    refreshSymbolUniverse: new RefreshSymbolUniverse({
      symbols,
      marketData,
      clock,
      maxAgeMs: config.market.symbolRefreshMs,
    }),
  };
}
