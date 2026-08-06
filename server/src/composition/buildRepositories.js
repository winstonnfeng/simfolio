/**
 * Chooses a repository set for the open connection. Both sets satisfy the same
 * ports, so this is the only file that changes when a driver is added.
 */
export async function buildRepositories({ config, db, ids, clock }) {
  const deps = { db, ids, clock };

  if (config.database.driver === 'postgres') {
    const [{ PgUserRepository }, { PgPortfolioRepository }, { PgWatchlistRepository }, { PgSymbolRepository }] =
      await Promise.all([
        import('../infrastructure/repositories/PgUserRepository.js'),
        import('../infrastructure/repositories/PgPortfolioRepository.js'),
        import('../infrastructure/repositories/PgWatchlistRepository.js'),
        import('../infrastructure/repositories/PgSymbolRepository.js'),
      ]);
    return {
      users: new PgUserRepository(deps),
      portfolios: new PgPortfolioRepository(deps),
      watchlists: new PgWatchlistRepository(deps),
      symbols: new PgSymbolRepository(deps),
    };
  }

  const [{ SqliteUserRepository }, { SqlitePortfolioRepository }, { SqliteWatchlistRepository }, { SqliteSymbolRepository }] =
    await Promise.all([
      import('../infrastructure/repositories/SqliteUserRepository.js'),
      import('../infrastructure/repositories/SqlitePortfolioRepository.js'),
      import('../infrastructure/repositories/SqliteWatchlistRepository.js'),
      import('../infrastructure/repositories/SqliteSymbolRepository.js'),
    ]);
  return {
    users: new SqliteUserRepository(deps),
    portfolios: new SqlitePortfolioRepository(deps),
    watchlists: new SqliteWatchlistRepository(deps),
    symbols: new SqliteSymbolRepository(deps),
  };
}
