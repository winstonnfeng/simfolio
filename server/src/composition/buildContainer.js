import { SystemClock } from '../domain/Clock.js';
import { UuidFactory } from '../infrastructure/identity/UuidFactory.js';
import { BcryptPasswordHasher } from '../infrastructure/security/BcryptPasswordHasher.js';
import { JwtTokenService } from '../infrastructure/security/JwtTokenService.js';
import { buildDatabase } from './buildDatabase.js';
import { buildRepositories } from './buildRepositories.js';
import { buildMarketData } from './buildMarketData.js';
import { buildUseCases } from './buildUseCases.js';

/**
 * Composition root. The only place in the codebase that names a concrete
 * adapter; every other module receives interfaces through its constructor.
 * Swapping Postgres for SQLite, Finnhub for Polygon, or the system clock for a
 * fixed one is a change here and nowhere else.
 *
 * The overrides argument lets an integration test replace any single
 * collaborator without standing up the rest by hand.
 */
export async function buildContainer({ config, overrides = {} }) {
  const clock = overrides.clock ?? new SystemClock();
  const ids = overrides.ids ?? new UuidFactory();
  const db = overrides.db ?? (await buildDatabase(config));

  const repositories = {
    ...(await buildRepositories({ config, db, ids, clock })),
    ...(overrides.repositories ?? {}),
  };

  const security = {
    passwordHasher: overrides.passwordHasher ?? new BcryptPasswordHasher({ rounds: config.auth.bcryptRounds }),
    tokens:
      overrides.tokens ??
      new JwtTokenService({ secret: config.auth.jwtSecret, expiresIn: config.auth.jwtExpiresIn }),
    ids,
  };

  const { marketData, broadcaster } =
    overrides.market ?? (await buildMarketData({ config, symbols: repositories.symbols, clock }));

  const useCases = buildUseCases({ config, repositories, security, marketData, clock });

  return {
    config,
    clock,
    db,
    ports: { ...repositories, ...security, marketData, broadcaster },
    useCases,
    async close() {
      await broadcaster.close();
      await db.close();
    },
  };
}
