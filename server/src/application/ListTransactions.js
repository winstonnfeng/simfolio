export class ListTransactions {
  constructor({ portfolios }) {
    this.portfolios = portfolios;
  }

  execute({ userId, limit = 100 }) {
    return this.portfolios.listTransactions(userId, Math.min(Number(limit) || 100, 500));
  }
}
