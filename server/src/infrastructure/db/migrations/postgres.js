/**
 * Mirrors the SQLite schema with the types Postgres does better: TIMESTAMPTZ
 * instead of integer epochs, BIGINT for cents, a functional unique index for
 * case-insensitive email, and a trigram index for symbol search.
 */
export const POSTGRES_MIGRATIONS = [
  {
    id: '001_initial',
    up: `
      CREATE TABLE users (
        id            UUID PRIMARY KEY,
        name          TEXT NOT NULL,
        email         TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX idx_users_email ON users (lower(email));

      CREATE TABLE accounts (
        id              UUID PRIMARY KEY,
        user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        cash_cents      BIGINT NOT NULL,
        deposited_cents BIGINT NOT NULL,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE positions (
        account_id     UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        symbol         TEXT NOT NULL,
        qty            INTEGER NOT NULL CHECK (qty > 0),
        avg_cost_cents BIGINT NOT NULL,
        PRIMARY KEY (account_id, symbol)
      );

      CREATE TYPE transaction_type AS ENUM ('buy', 'sell', 'deposit');

      CREATE TABLE transactions (
        id             UUID PRIMARY KEY,
        account_id     UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        type           transaction_type NOT NULL,
        symbol         TEXT,
        qty            INTEGER,
        price_cents    BIGINT,
        amount_cents   BIGINT NOT NULL,
        realized_cents BIGINT NOT NULL DEFAULT 0,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_transactions_account_time ON transactions (account_id, created_at DESC);

      CREATE TABLE watchlist_items (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        symbol  TEXT NOT NULL,
        sort    INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, symbol)
      );
    `,
  },
  {
    id: '002_symbol_universe',
    up: `
      CREATE TABLE symbols (
        symbol   TEXT PRIMARY KEY,
        name     TEXT NOT NULL,
        kind     TEXT NOT NULL,
        exchange TEXT
      );

      CREATE EXTENSION IF NOT EXISTS pg_trgm;
      CREATE INDEX idx_symbols_name_trgm ON symbols USING gin (name gin_trgm_ops);
      CREATE INDEX idx_symbols_symbol_prefix ON symbols (symbol text_pattern_ops);

      CREATE TABLE app_meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
  },
];
