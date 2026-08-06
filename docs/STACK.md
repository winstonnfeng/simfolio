# Stack

Everything this project uses, and why it is there.

## Client — Design Component (streaming HTML + React runtime)

| Piece | Role |
| --- | --- |
| `Simfolio.dc.html` (template) | **View.** Markup and inline styles only |
| `Simfolio.dc.html` (logic class) | **ViewModel.** Screen state, commands, display strings |
| `src/gateways/TradingGateway.js` | The one contract the ViewModel programs against |
| `src/gateways/RemoteTradingGateway.js` | Adapter over the Express API (polled quotes) |
| `src/gateways/LocalTradingGateway.js` | Adapter over the in-browser domain + localStorage |
| `src/gateways/resolveGateway.js` | Picks an adapter by probing `/health` at boot |
| `src/api/HttpClient.js` | fetch wrapper: base URL, bearer token, one error shape |
| `src/api/tokenStorage.js` | JWT persistence |
| `EventSource` in `RemoteTradingGateway` | Live quote stream, with polling fallback |
| `src/portfolio.js` | Pure trade reducers (offline mode) |
| `src/marketData.js` | Offline simulator: catalogue, deterministic history, `PriceFeed` |
| `src/accounts.js` | Only client module touching localStorage |
| `src/format.js` | Currency, percent, date formatters |
| `src/chart.js` | Series to SVG path geometry |

No framework CLI, no bundler, no CSS framework. Charts are hand-built SVG paths —
no charting dependency. Fonts: Manrope (UI) and JetBrains Mono (figures) via Google Fonts.

## Server — `server/`

| Piece | Choice | Why |
| --- | --- | --- |
| Runtime | Node 20+, ES modules | Native `fetch`, native test runner, no build step |
| HTTP | Express 4 | Small, readable, easy to review |
| Validation | zod | Schemas at the HTTP edge; domain stays framework-free |
| Database | PostgreSQL via `pg` | Real concurrency, row locks, trigram search |
| Dev database | SQLite via better-sqlite3 | Zero setup; same repository ports, used by tests |
| Migrations | Hand-rolled runners, one per driver | Explicit, versioned, no ORM to learn |
| Live prices | `ws` upstream → SSE downstream | One vendor socket fans out to every browser |
| Passwords | bcryptjs | Salted hashing |
| Sessions | jsonwebtoken (HS256) | Stateless API |
| Config | dotenv + `config/config.js` | `createConfig(source)` builds a frozen object; only entrypoints read `process.env` |
| Quotes | Finnhub REST | Free tier: real-time US quotes, symbol search, profiles, metrics |
| Price history | Twelve Data `/time_series` | Free tier includes intraday; Finnhub candles are premium-only |
| History fallback | Stooq daily CSV | No key, no rate limit — daily granularity only |
| Offline data | `StaticQuoteProvider` / `StaticHistoryProvider` | Deterministic data so dev and tests need no vendor |
| Caching | `CachingMarketData` decorator | TTL cache + in-flight de-duplication, wrapped around `MarketDataService` |
| Tests | `node --test` | Zero dependencies; domain, config, use cases, repositories, HTTP |

Storage is chosen by `DATABASE_URL`: set it for Postgres, omit it for SQLite. Both
satisfy the same repository ports, and the driver is imported dynamically so a
SQLite deployment never loads `pg`.

No ORM, no Docker, no Redis — deliberately. Each would be justified by a specific
problem this project does not have yet.

## Architecture patterns

- **MVVM** on the client: View / ViewModel / Model, strictly separated.
- **Ports and adapters** on both sides: `domain/ports.js` server-side,
  `gateways/TradingGateway.js` client-side. Vendors live only in adapters.
- **Use-case classes** — one file per user action, dependencies injected.
- **Composition roots** — `server/src/composition/` (`buildContainer` plus four focused
  builders) and `src/gateways/resolveGateway.js` are the only places that name concrete
  implementations.
- **Clock and IdFactory are ports** — the domain never calls `Date.now()` or
  `randomUUID()`, so every rule is deterministic under a `FixedClock`.
- **Integer cents** inside the server; dollars only at the HTTP boundary.

## Why not…

| Considered | Verdict |
| --- | --- |
| Next.js / React SPA + bundler | Adds a build step for a client that already streams |
| Prisma / TypeORM | Five tables and hand-written SQL is clearer here |
| Alpha Vantage | 25 requests/day on the free tier |
| Finnhub for charts | Historical candles return 403 on free keys |
| Candlestick charts | The design shows closing prices as a line; OHLC is not needed |
| Chart.js / Recharts | Two SVG path helpers replace a dependency |
| Tailwind | Inline styles keep the streaming Design Component paint-first |

## Recommended production path

Done: Postgres behind the same ports, and the vendor WebSocket relayed as SSE.
Remaining: refresh tokens in httpOnly cookies, rate limiting at the edge, and
Redis-backed fan-out if the API ever runs on more than one instance (today each
process holds its own upstream socket).
