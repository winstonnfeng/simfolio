# Git workflow

`main` is always deployable. Work happens on short branches merged by pull request.

## Branch names

```
feat/order-execution      new capability
fix/sell-rounding         bug fix
refactor/split-viewmodel  no behaviour change
docs/api-reference        docs only
chore/ci-node-test        tooling
```

## Commits

Conventional Commits, imperative, scoped to a layer:

```
feat(domain): add average-cost blending to buy()
feat(api): POST /api/orders executes at server-fetched quote
fix(domain): round realised P/L to whole cents
test(domain): cover insufficient-shares rejection
docs(architecture): explain the ports and adapters split
```

One concern per commit. If the message needs "and", it is two commits.

## Pull request template

```markdown
## What
One paragraph on the change.

## Why
The problem or user need.

## How
Layers touched and any new port/adapter.

## Testing
Commands run, cases covered.

## Screenshots
UI changes only.
```

## Suggested history for this project

| PR | Branch | Contents |
| --- | --- | --- |
| #1 | `chore/scaffold` | Repo layout, package.json, env example, README skeleton |
| #2 | `feat/domain-portfolio` | `domain/portfolio.js`, typed errors, unit tests |
| #3 | `feat/persistence-sqlite` | Migrations, three repositories, cents mapping |
| #4 | `feat/auth` | bcrypt hasher, JWT service, register/login/me, authenticate middleware |
| #5 | `feat/market-data` | Instrument catalogue, Finnhub adapter, static provider, cache decorator |
| #6 | `feat/order-execution` | `PlaceOrder`, `DepositCash`, portfolio routes, presenters |
| #7 | `feat/client-shell` | Design Component shell, auth screen, MVVM split |
| #8 | `feat/client-dashboard` | Portfolio dashboard, holdings, watchlist, charts |
| #9 | `feat/client-trade-flow` | Stock detail, order ticket, cash and activity screens |
| #10 | `feat/api-integration` | `TradingGateway` port, remote + local adapters, `resolveGateway` |
| #11 | `docs/architecture` | Architecture, API and workflow docs |

| #12 | `feat/real-market-data` | Quote/history port split, Finnhub + Twelve Data + Stooq adapters, symbol universe, search |
| #13 | `feat/postgres` | Pg repositories behind the same ports, SQL migrations, pooled connections, driver selection |
| #14 | `feat/streaming-quotes` | `QuoteStream` port, Finnhub socket + polling adapters, broadcaster, SSE endpoint |
| #15 | `feat/watchlist-toggle` | Add/remove from the stock detail screen, optimistic update |

Tag `v0.1.0` after #9 (offline prototype), `v0.2.0` after #10 (live backend),
`v0.3.0` after #14 (Postgres and streaming prices).

## Definition of done

- Domain changes come with unit tests (`npm test` in `server/`).
- No business rule added outside `domain/`.
- No vendor name imported outside `infrastructure/` and `composition/`.
- Money handled as integer cents inside the server.
- `docs/API.md` updated when a route changes.
