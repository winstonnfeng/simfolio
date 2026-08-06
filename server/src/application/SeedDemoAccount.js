/**
 * Creating the demo account is application behaviour, not a script: it is
 * spelled out as a use case so it runs through the same rules as a real signup
 * — real password hashing, real order execution at real prices, real watchlist
 * validation. A seed that bypassed the use cases could produce state the app
 * itself can never reach.
 *
 * Idempotent: re-running only refreshes the watchlist.
 */
export class SeedDemoAccount {
  constructor({ users, registerUser, placeOrder, manageWatchlist, logger = console }) {
    this.users = users;
    this.registerUser = registerUser;
    this.placeOrder = placeOrder;
    this.manageWatchlist = manageWatchlist;
    this.logger = logger;
  }

  async execute({ credentials, positions = [], watchlist = [] }) {
    const existing = await this.users.findByEmail(credentials.email);
    const user = existing ?? (await this.#createWithPositions(credentials, positions));

    if (existing) this.logger.log(`[seed] ${credentials.email} already exists`);
    if (watchlist.length > 0) await this.manageWatchlist.replace({ userId: user.id, symbols: watchlist });

    return { user, created: !existing };
  }

  async #createWithPositions(credentials, positions) {
    const { user } = await this.registerUser.execute(credentials);
    for (const { symbol, qty } of positions) {
      await this.placeOrder.execute({ userId: user.id, side: 'buy', symbol, qty });
    }
    this.logger.log(`[seed] created ${credentials.email} with ${positions.length} positions`);
    return user;
  }
}
