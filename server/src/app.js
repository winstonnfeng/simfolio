import express from 'express';
import cors from 'cors';
import { describeConfig } from './config/config.js';
import { authenticate as bearerAuth } from './interfaces/http/middleware/authenticate.js';
import { errorHandler, notFoundHandler } from './interfaces/http/middleware/errorHandler.js';
import { authRoutes } from './interfaces/http/routes/authRoutes.js';
import { portfolioRoutes } from './interfaces/http/routes/portfolioRoutes.js';
import { marketRoutes } from './interfaces/http/routes/marketRoutes.js';
import { watchlistRoutes } from './interfaces/http/routes/watchlistRoutes.js';
import { streamRoutes } from './interfaces/http/routes/streamRoutes.js';

/**
 * Builds the Express application from an already-composed container.
 *
 * Nothing here constructs a dependency and nothing reads process.env — the app
 * is a pure function of (config, ports, useCases), so a test can mount it over
 * fakes without a database, a vendor key, or a listening socket.
 *
 * Mount order matters. The portfolio router sits on the bare `/api` prefix and
 * applies bearer auth to everything entering it, so every more specific path
 * must be registered BEFORE it — otherwise a public request like
 * /api/market/instruments is rejected for having no token before it ever
 * reaches the market router.
 */
export function createApp({ config, ports, useCases }) {
  const app = express();
  const authenticate = bearerAuth(ports.tokens);

  app.use(cors({ origin: config.http.corsOrigin }));
  app.use(express.json({ limit: config.http.bodyLimit }));

  app.get('/health', (_req, res) => res.json({ ok: true, ...describeConfig(config) }));

  app.use(
    '/api/auth',
    authRoutes({
      registerUser: useCases.registerUser,
      loginUser: useCases.loginUser,
      users: ports.users,
      authenticate,
    })
  );

  app.use(
    '/api/market',
    marketRoutes({
      getMarketData: useCases.getMarketData,
      searchInstruments: useCases.searchInstruments,
      getInstrument: useCases.getInstrument,
    })
  );

  app.use('/api/watchlist', watchlistRoutes({ manageWatchlist: useCases.manageWatchlist, authenticate }));

  // SSE authenticates from a query parameter, so it sits outside the bearer middleware.
  app.get('/api/stream/quotes', streamRoutes({ broadcaster: ports.broadcaster, tokens: ports.tokens }));

  // Last: this one guards the whole /api prefix.
  app.use(
    '/api',
    portfolioRoutes({
      getPortfolio: useCases.getPortfolio,
      placeOrder: useCases.placeOrder,
      depositCash: useCases.depositCash,
      listTransactions: useCases.listTransactions,
      authenticate,
    })
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
