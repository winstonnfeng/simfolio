import { config } from './config/loadConfig.js';
import { startServer } from './bootstrap.js';

/**
 * The process entrypoint, and the only module allowed to read the environment
 * or install signal handlers. All of the work lives in startServer.
 */
const { stop } = await startServer({ config });

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    await stop(signal);
    process.exit(0);
  });
}
