import { config } from '../src/config/loadConfig.js';
import { buildContainer } from '../src/composition/buildContainer.js';
import { runMigrations } from '../src/infrastructure/db/runMigrations.js';
import { SeedDemoAccount } from '../src/application/SeedDemoAccount.js';

const DEMO = {
  credentials: { name: 'Amanda Chen', email: 'demo@paper.app', password: 'demo123' },
  positions: [
    { symbol: 'AAPL', qty: 60 },
    { symbol: 'VOO', qty: 40 },
    { symbol: 'NVDA', qty: 120 },
    { symbol: 'COST', qty: 8 },
    { symbol: 'SCHD', qty: 150 },
  ],
  watchlist: ['NVDA', 'VOO', 'TSLA', 'KO', 'QQQ'],
};

const container = await buildContainer({ config });
try {
  await runMigrations({ db: container.db, driver: config.database.driver });
  const seed = new SeedDemoAccount({ ...container.ports, ...container.useCases });
  await seed.execute(DEMO);
} finally {
  await container.close();
}
