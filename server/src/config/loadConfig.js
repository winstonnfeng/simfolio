import 'dotenv/config';
import { createConfig } from './config.js';

/**
 * The process-level config. Only entrypoints (index.js and the CLI scripts)
 * may import this — everything else receives config through its constructor.
 */
export const config = createConfig(process.env);
