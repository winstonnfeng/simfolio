/**
 * Configuration is built from a source object rather than read from
 * process.env at import time. Nothing below the composition root imports a
 * config singleton, so every module can be constructed with whatever settings
 * a test needs.
 */

function bool(value, fallback = false) {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

function int(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function requireValue(name, value, fallback) {
  const resolved = value ?? fallback;
  if (resolved === undefined || resolved === '') throw new Error(`Missing environment variable: ${name}`);
  return resolved;
}

/**
 * Provider selection is derived, not configured twice: supplying a key is what
 * turns a vendor on. With no keys at all the server runs fully offline against
 * the static providers.
 */
function selectProviders({ finnhubApiKey, twelveDataApiKey }) {
  return {
    quoteProvider: finnhubApiKey ? 'finnhub' : 'static',
    historyProvider: twelveDataApiKey ? 'twelvedata' : finnhubApiKey ? 'stooq' : 'static',
    streamProvider: finnhubApiKey ? 'finnhub-socket' : 'polling',
  };
}

export function createConfig(source = process.env) {
  const finnhubApiKey = source.FINNHUB_API_KEY ?? '';
  const twelveDataApiKey = source.TWELVEDATA_API_KEY ?? '';
  const databaseUrl = source.DATABASE_URL ?? '';

  return Object.freeze({
    http: Object.freeze({
      port: int(source.PORT, 4000),
      corsOrigin: source.CORS_ORIGIN ?? '*',
      bodyLimit: source.BODY_LIMIT ?? '64kb',
    }),
    auth: Object.freeze({
      jwtSecret: requireValue('JWT_SECRET', source.JWT_SECRET, 'dev-only-insecure-secret'),
      jwtExpiresIn: source.JWT_EXPIRES_IN ?? '7d',
      bcryptRounds: int(source.BCRYPT_ROUNDS, 10),
    }),
    database: Object.freeze({
      driver: databaseUrl ? 'postgres' : 'sqlite',
      url: databaseUrl,
      file: source.DATABASE_FILE ?? './data/simfolio.db',
      poolMax: int(source.PG_POOL_MAX, 10),
      ssl: bool(source.PG_SSL),
    }),
    market: Object.freeze({
      ...selectProviders({ finnhubApiKey, twelveDataApiKey }),
      finnhubApiKey,
      twelveDataApiKey,
      quoteCacheTtlMs: int(source.QUOTE_CACHE_TTL_MS, 15_000),
      profileCacheTtlMs: int(source.PROFILE_CACHE_TTL_MS, 86_400_000),
      historyCacheTtlMs: int(source.HISTORY_CACHE_TTL_MS, 300_000),
      searchCacheTtlMs: int(source.SEARCH_CACHE_TTL_MS, 60_000),
      streamIntervalMs: int(source.STREAM_INTERVAL_MS, 4_000),
      streamThrottleMs: int(source.STREAM_THROTTLE_MS, 1_000),
      symbolRefreshMs: int(source.SYMBOL_REFRESH_HOURS, 24) * 3_600_000,
    }),
    trading: Object.freeze({
      startingCashCents: Math.round(Number(source.STARTING_CASH ?? 100_000) * 100),
    }),
    nodeEnv: source.NODE_ENV ?? 'development',
  });
}

/** One-line summary for boot logs and /health. */
export function describeConfig(config) {
  return {
    storage: config.database.driver,
    quotes: config.market.quoteProvider,
    history: config.market.historyProvider,
    stream: config.market.streamProvider,
  };
}
