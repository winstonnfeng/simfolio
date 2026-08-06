# Architecture

Two deployables, one shared vocabulary.

```
┌─────────────────────────── client ───────────────────────────┐
│  View        Simfolio.dc.html  (markup only)             │
│  ViewModel   Component class       (screen state, handlers)  │
│  Gateway     TradingGateway port                             │
│                ├─ RemoteTradingGateway  → HTTP API           │
│                └─ LocalTradingGateway   → in-browser domain  │
│  Model       src/portfolio.js  src/marketData.js             │
│              src/accounts.js   src/format.js  src/chart.js   │
└──────────────────────────── HTTP ────────────────────────────┘
┌─────────────────────────── server ───────────────────────────┐
│  index.js           entrypoint — the only reader of env      │
│  bootstrap.js       migrate · listen · warm · shut down      │
│  composition/       the composition root (4 builders)        │
│  interfaces/http    routes · validation · presenters         │
│  application        RegisterUser · PlaceOrder · …            │
│  domain             portfolio rules · errors · ports · Clock │
│  infrastructure     Postgres / SQLite · Finnhub · Twelve Data │
│                     Stooq · quote stream · bcrypt · JWT       │
└──────────────────────────────────────────────────────────────┘

Dependencies point inward only. domain imports nothing; application imports
domain; infrastructure implements domain ports; composition is the one place
that names a concrete class.
```

## Client: MVVM

- **View** — `Simfolio.dc.html` template. Markup and inline styles, nothing else.
  It reads named values and handlers; it contains no calculations.
- **ViewModel** — the `Component` logic class. Holds screen state (current screen,
  selected symbol, chart range, order side, form inputs), calls the model, and maps
  domain output to display strings via `format.js`. No business rules live here.
- **Model** — four single-purpose modules:
  - `src/portfolio.js` — pure trade reducers and valuation. No DOM, no storage.
  - `src/marketData.js` — instrument catalogue, deterministic history, `PriceFeed`.
  - `src/accounts.js` — the only module that touches `localStorage`.
  - `src/format.js` — presentation formatters.

## Client: one gateway, two adapters

The ViewModel never calls `fetch` and never reads `localStorage`. It depends on the
`TradingGateway` port — `register`, `login`, `getPortfolio`, `placeOrder`, `deposit`,
`listTransactions`, `getWatchlist`, `getSeries`, `subscribeQuotes` — and two adapters
implement it:

- **RemoteTradingGateway** — the Express API. JWT in `Authorization` (held in an
  injected `TokenStore`, not a module global), quotes over server-sent events with
  batched polling as the fallback.
- **LocalTradingGateway** — the in-browser domain plus `localStorage`, mapping its
  output onto the exact response shapes of the API presenters.

`resolveGateway()` probes `GET /health` at boot with a 1.2s timeout and picks one. So
the same file runs as an offline prototype and as a real client with no flag to flip,
and screen code cannot drift from the API contract — both adapters return dollars in
identical shapes.

Two consequences worth noting: portfolio history is reconstructed from holdings
(`sum(qty x candle price) + cash`) rather than a bespoke endpoint, so it works against
real candles and simulated ones alike; and price series are cached per
`symbol:range` in the ViewModel, fetched once and re-rendered on arrival.

## Server: layered / hexagonal

**domain** — `portfolio.js` holds every trade rule as pure functions over a snapshot
`{ cashCents, depositedCents, positions }`. Each returns `{ portfolio, transaction }`
or throws a typed `DomainError`. No dates from the ambient clock, no I/O, no Express.
This is the layer worth unit-testing, and `test/portfolio.test.js` covers it.

**application** — one class per use case, dependencies injected through the
constructor. A use case orchestrates: load state, ask the domain, persist, read back.
`PlaceOrder` is the representative example — it fetches the quote itself rather than
trusting input, then delegates the maths to `domain/portfolio.js`.

**infrastructure** — adapters that satisfy the ports in `domain/ports.js`. Market data
is split into two ports because no free vendor covers both halves well:
`QuoteProvider` (Finnhub: real-time quotes, search, profiles) and `HistoryProvider`
(Twelve Data intraday, or keyless Stooq daily). `MarketDataService` composes them into
one `MarketData` port; `CachingMarketData` is a decorator around it that owns TTLs and
in-flight de-duplication. Both implement the same port, so a use case cannot tell
whether a quote was cached, and caching can be removed in a test by not wrapping.
`SqliteSymbolRepository` caches the US
symbol universe so search is a local query. Static providers cover offline mode.

**interfaces/http** — Express routers, zod body schemas, and presenters that convert
cents to dollars. Route handlers are three lines: validate, call use case, present.

**composition/** — the composition root, split by concern: `buildDatabase`,
`buildRepositories`, `buildMarketData`, `buildUseCases`, assembled by
`buildContainer`. It is the only code in the project that names a concrete adapter,
so swapping SQLite for Postgres or Finnhub for Polygon touches one builder and one
new class. `buildContainer` accepts an `overrides` bag so a test can replace any
single collaborator without standing up the rest.

The split pays off immediately at the edges: `bin/migrate.js` needs a database and
nothing else, so it calls `buildDatabase` alone — no vendor keys, no HTTP layer, no
market providers loaded to run a migration.

**config** — `createConfig(source)` builds a frozen settings object from any source
object; `loadConfig.js` is the single module that passes it `process.env`, and only
entrypoints may import it. Nothing below the composition root reads the environment,
which is what makes `createConfig({ … })` in a test enough to reconfigure the app.

**Time and identity are dependencies.** `Clock` and `IdFactory` are ports like any
other. The domain never calls `Date.now()` or `randomUUID()`, so every trade rule is
deterministic under `FixedClock`.

## Decisions and trade-offs

## Storage: two drivers, one port

`PortfolioRepository`, `UserRepository`, `WatchlistRepository` and `SymbolRepository`
each have a SQLite and a Postgres implementation. `buildRepositories()` picks a set
from `DATABASE_URL` and imports it dynamically, so neither driver is loaded
unnecessarily. Two differences are worth knowing rather than hiding:

- The Postgres `applyTrade` takes `SELECT … FOR UPDATE` on the account row, so two
  concurrent orders serialise. SQLite gets this free from its write lock.
- Symbol search uses a `pg_trgm` GIN index on Postgres and `LIKE` on SQLite. Same
  results at this scale; only Postgres stays fast as the universe grows.

## Live prices: one socket, many browsers

`QuoteStream` is the port. `FinnhubSocketQuoteStream` holds one upstream WebSocket
and throttles trade prints to one per symbol per second; `PollingQuoteStream` covers
offline mode and vendors without a socket. `QuoteBroadcaster` sits above, reference-
counting symbols so the upstream subscription list matches what users are actually
watching, and replaying the last known price to a new connection so it paints
immediately.

Browsers receive SSE, not WebSockets: the data flows one way, it rides on plain HTTP,
and `EventSource` reconnects by itself. The client falls back to batched polling only
if the stream closes hard.

| Decision | Reason | Cost |
| --- | --- | --- |
| Integer cents | Floating-point money drifts | Conversion at the edges |
| SQLite first | Runs with no services | Migration needed for concurrent scale |
| Server-priced orders | Client price is spoofable | Extra quote fetch per order |
| Positions rewritten per trade | Simple, always consistent | Fine at this scale, not at 10k positions |
| Static provider fallback | Offline dev and deterministic tests | Two providers to keep in step |
| Quotes and history split | No free vendor does both well | Two adapters, two keys |
| Symbol table cached locally | Search costs no vendor quota | Daily refresh job |
| SSE downstream, WebSocket upstream | One vendor connection, simple browser API | One HTTP stream per tab |
| In-process broadcaster | No extra infrastructure | Needs Redis fan-out to scale past one instance |

## Testing

Four suites, each aimed at one seam. All of them run with `npm test`, in about a
second, with no database and no API keys — that is the return on the injection.

| Suite | What it pins down | How it isolates |
| --- | --- | --- |
| `portfolio.test.js` | Trade rules, valuation, immutability | Pure functions, explicit timestamps |
| `config.test.js` | Provider selection, parsing, immutability | `createConfig({ … })` over a literal |
| `useCases.test.js` | Orchestration: auth, server pricing, idempotent seeding | Fakes for every port |
| `repositories.test.js` | Real SQL: transactions, rollback, ordering | In-memory SQLite, injected |
| `http.test.js` | Routing, validation, auth, error status mapping | `createApp` over fakes, ephemeral port |

Two of these are only writable because of a specific design choice.
`repositories.test.js` opens `:memory:` and hands it to the repositories, which is
possible because they take a connection instead of importing one.
`http.test.js` mounts the entire Express app over in-memory repositories and a stub
price list, which is possible because `createApp` is a pure function of
`(config, ports, useCases)`.

## Next increments

1. Postgres integration tests behind the same suite, run against a throwaway database.
2. Refresh tokens in an httpOnly cookie, replacing the localStorage access token.
3. Redis fan-out for the broadcaster, so the quote stream survives more than one instance.
4. Limit orders — a new domain function plus a scheduler, no HTTP change.
