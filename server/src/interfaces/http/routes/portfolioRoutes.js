import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../asyncHandler.js';
import { validateBody } from '../middleware/validate.js';
import { presentSummary, presentTransaction } from '../presenters/portfolioPresenter.js';

const orderSchema = z.object({
  side: z.enum(['buy', 'sell']),
  symbol: z.string().min(1).max(8),
  qty: z.number().int().positive(),
});

const depositSchema = z.object({ amount: z.number().positive().max(1_000_000) });

export function portfolioRoutes({ getPortfolio, placeOrder, depositCash, listTransactions, authenticate }) {
  const router = Router();
  router.use(authenticate);

  router.get(
    '/portfolio',
    asyncHandler(async (req, res) => {
      const { summary } = await getPortfolio.execute({ userId: req.userId });
      res.json({ portfolio: presentSummary(summary) });
    })
  );

  router.post(
    '/orders',
    validateBody(orderSchema),
    asyncHandler(async (req, res) => {
      const { execution, summary } = await placeOrder.execute({ userId: req.userId, ...req.body });
      res.status(201).json({ execution: presentTransaction(execution), portfolio: presentSummary(summary) });
    })
  );

  router.post(
    '/cash/deposits',
    validateBody(depositSchema),
    asyncHandler(async (req, res) => {
      const { transaction, summary } = await depositCash.execute({ userId: req.userId, amount: req.body.amount });
      res.status(201).json({ transaction: presentTransaction(transaction), portfolio: presentSummary(summary) });
    })
  );

  router.get(
    '/transactions',
    asyncHandler(async (req, res) => {
      const transactions = await listTransactions.execute({ userId: req.userId, limit: req.query.limit });
      res.json({ transactions: transactions.map(presentTransaction) });
    })
  );

  return router;
}
