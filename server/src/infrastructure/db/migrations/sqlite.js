export const SQLITE_MIGRATIONS = [
  {
    id: '001_initial',
    up: `
      CREATE TABLE users (
        id            TEXT PRIMARY KEY,
        name          TEXT NOT NULL,
        email         TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at    INTEGER NOT NULL
      );

      CREATE TABLE accounts (
        id              TEXT PRIMARY KEY,
        user_id         TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        cash_cents      INTEGER NOT NULL,
        deposited_cents INTEGER NOT NULL,
        created_at      INTEGER NOT NULL
      );

      CREATE TABLE positions (
        account_id     TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        symbol         TEXT NOT NULL,
        qty            INTEGER NOT NULL CHECK (qty > 0),
        avg_cost_cents INTEGER NOT NULL,
        PRIMARY KEY (account_id, symbol)
      );

      CREATE TABLE transactions (
        id              TEXT PRIMARY KEY,
        account_id      TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        type            TEXT NOT NULL CHECK (type IN ('buy','sell','deposit')),
        symbol          TEXT,
        qty             INTEGER,
        price_cents     INTEGER,
        amount_cents    INTEGER NOT NULL,
        realized_cents  INTEGER NOT NULL DEFAULT 0,
        created_at      INTEGER NOT NULL
      );

      CREATE INDEX idx_transactions_account_time ON transactions(account_id, created_at DESC);

      CREATE TABLE watchlist_items (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

      CREATE INDEX idx_symbols_name ON symbols(name);

      CREATE TABLE app_meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
  },
];
