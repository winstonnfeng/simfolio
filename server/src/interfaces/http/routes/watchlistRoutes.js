import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../asyncHandler.js';
import { validateBody } from '../middleware/validate.js';

const watchlistSchema = z.object({ symbols: z.array(z.string().min(1).max(8)) });

export function watchlistRoutes({ manageWatchlist, authenticate }) {
  const router = Router();
  router.use(authenticate);

  router.get(
    '/',
    asyncHandler(async (req, res) => res.json({ symbols: await manageWatchlist.list({ userId: req.userId }) }))
  );

  router.put(
    '/',
    validateBody(watchlistSchema),
    asyncHandler(async (req, res) =>
      res.json({ symbols: await manageWatchlist.replace({ userId: req.userId, symbols: req.body.symbols }) })
    )
  );

  return router;
}
