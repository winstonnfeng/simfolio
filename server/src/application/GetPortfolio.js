export class GetPortfolio {
  constructor({ portfolioService }) {
    this.portfolioService = portfolioService;
  }

  async execute({ userId }) {
    const portfolio = await this.portfolioService.loadOrFail(userId);
    return this.portfolioService.summarize(portfolio);
  }
}
