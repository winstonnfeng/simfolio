import { Router } from 'express';
import { asyncHandler } from '../asyncHandler.js';
import { presentPriceHistory, presentQuote } from '../presenters/portfolioPresenter.js';

export function marketRoutes({ getMarketData, searchInstruments, getInstrument }) {
  const router = Router();

  /** Default list for the empty search state — not a limit on what is tradable. */
  router.get(
    '/instruments',
    asyncHandler(async (_req, res) => res.json({ instruments: await searchInstruments.listPopular() }))
  );

  router.get(
    '/search',
    asyncHandler(async (req, res) => res.json({ results: await searchInstruments.execute({ query: req.query.q }) }))
  );

  router.get(
    '/instruments/:symbol',
    asyncHandler(async (req, res) => {
      const { instrument, quote } = await getInstrument.execute({ symbol: req.params.symbol });
      res.json({ instrument, quote: quote ? presentQuote(quote) : null });
    })
  );

  /** Batch quotes keep a whole watchlist inside one round trip and one cache pass. */
  router.get(
    '/quotes',
    asyncHandler(async (req, res) => {
      const symbols = String(req.query.symbols ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      const quotes = await getMarketData.getQuotes(symbols);
      res.json({ quotes: Object.fromEntries(Object.entries(quotes).map(([key, value]) => [key, presentQuote(value)])) });
    })
  );

  router.get(
    '/quotes/:symbol',
    asyncHandler(async (req, res) => res.json({ quote: presentQuote(await getMarketData.getQuote(req.params.symbol)) }))
  );

  router.get(
    '/history/:symbol',
    asyncHandler(async (req, res) =>
      res.json({ history: presentPriceHistory(await getMarketData.getPriceHistory(req.params.symbol, req.query.range)) })
    )
  );

  return router;
}
