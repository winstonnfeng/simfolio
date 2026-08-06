# Simfolio API

Backend for the Simfolio app: accounts, portfolios, market-order execution
against live quotes, cash deposits and transaction history — all with simulated money.

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Runtime | Node 20+, ESM | No build step, native `fetch`, native test runner |
| HTTP | Express 4 | Thin, well understood, easy to review |
| Storage | PostgreSQL (`pg`), SQLite fallback | Same ports; `DATABASE_URL` chooses |
| Live prices | `ws` upstream, SSE downstream | One vendor socket serves every browser |
| Auth | JWT + bcrypt | Stateless API, hashed credentials |
| Validation | zod | Schema at the HTTP edge, domain stays clean |
| Quotes | Finnhub (free tier) | Real-time US quotes, symbol search, company profiles |
| Price history | Twelve Data, Stooq fallback | Finnhub candles are premium; both alternatives are free |

## Run it

```bash
cd server
cp .env.example .env      # set JWT_SECRET; add FINNHUB_API_KEY + TWELVEDATA_API_KEY for live data
npm install
npm run migrate           # applies the schema for whichever driver is configured
npm run seed              # creates demo@paper.app / demo123
npm run dev               # http://localhost:4000
npm test                  # domain, config, use-case, repository and HTTP suites
```

## Storage

| `DATABASE_URL` | Driver | Notes |
| --- | --- | --- |
| unset | SQLite file | Zero setup, used by tests |
| set | PostgreSQL | Pooled, `FOR UPDATE` on trades, `pg_trgm` symbol search |

```bash
createdb paper_trader
DATABASE_URL=postgres://postgres:postgres@localhost:5432/paper_trader npm run migrate
```

## Market data providers

| Keys present | Quotes | Price history |
| --- | --- | --- |
| none | `StaticQuoteProvider` (simulated) | `StaticHistoryProvider` (simulated) |
| `FINNHUB_API_KEY` | Finnhub, real-time | Stooq daily CSV (keyless) |
| both keys | Finnhub, real-time | Twelve Data, intraday |

Free-tier limits worth respecting: Finnhub 60 req/min, Twelve Data 800 credits/day.
`MarketDataService` caches quotes for `QUOTE_CACHE_TTL_MS` (15s), history for 5 min,
profiles for 24h, and de-duplicates concurrent requests for the same symbol. The
symbol table is refreshed at most once every `SYMBOL_REFRESH_HOURS`, so search
never touches a vendor.

## Layout

```
bin/               migrate · seed — CLI entrypoints
src/
  index.js         process entrypoint: config in, signals handled
  bootstrap.js      migrate · listen · warm the symbol table · shut down
  app.js            createApp(container) — a pure function, no env, no I/O
  config/           createConfig(source); only entrypoints read process.env
  domain/           entities, invariants, errors, ports — no I/O, no framework
  application/      one class per use case, depends only on ports
  infrastructure/   SQLite/Postgres repositories, market adapters, bcrypt, JWT
  interfaces/http/  Express routes, validation, presenters (cents -> dollars)
  composition/      the composition root: the only code naming concrete adapters
```

Dependencies point inward only: `interfaces -> application -> domain`.
Infrastructure implements the ports in `domain/ports.js` and is injected at the root.

## Rules worth knowing

- **Money is integer cents everywhere** inside the server. Dollars only exist in
  HTTP payloads, converted in `interfaces/http/presenters`.
- **Execution price is fetched server-side.** A client can request a side, symbol
  and quantity — never a price.
- **A trade is one SQL transaction.** Cash, positions and history cannot drift.
- **Whole shares only.** Fractional support would be a domain change, not a UI one.
- **Every US-listed symbol is tradable.** The popular list is only the empty-search state.
- **Closing prices, not candles.** The chart is a line; providers return closes.
- **One upstream socket.** `QuoteBroadcaster` reference-counts symbols and fans out
  over SSE, so 100 browsers do not open 100 vendor connections.

See `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/GIT-WORKFLOW.md`.
