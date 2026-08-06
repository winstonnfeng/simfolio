import { deposit } from '../domain/portfolio.js';
import { toCents } from '../shared/money.js';

export class DepositCash {
  constructor({ portfolioService, clock }) {
    this.portfolioService = portfolioService;
    this.clock = clock;
  }

  async execute({ userId, amount }) {
    const portfolio = await this.portfolioService.loadOrFail(userId);
    const result = deposit(portfolio, { amountCents: toCents(amount), now: this.clock.now() });
    return this.portfolioService.commit(userId, result);
  }
}
