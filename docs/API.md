# API reference

Base URL `http://localhost:4000`. JSON in, JSON out. Amounts in payloads are
dollars; the server stores cents. Authenticated routes need `Authorization: Bearer <token>`.

Errors always take the shape:

```json
{ "error": { "code": "INSUFFICIENT_FUNDS", "message": "Not enough buying power for this order" } }
```

Codes: `VALIDATION_ERROR` 422 · `AUTH_ERROR` 401 · `NOT_FOUND` 404 · `CONFLICT` 409 ·
`INSUFFICIENT_FUNDS` 422 · `INSUFFICIENT_SHARES` 422 · `INTERNAL` 500.

## Auth

### POST /api/auth/register → 201
```json
{ "name": "Amanda Chen", "email": "amanda@example.com", "password": "correct-horse" }
```
Returns `{ user, token }`. Creates the account and funds it with `STARTING_CASH`.

### POST /api/auth/login → 200
`{ "email": "...", "password": "..." }` → `{ user, token }`.
Wrong email and wrong password return the same message by design.

### GET /api/auth/me → 200 🔒
`{ "user": { "id", "name", "email" } }`

## Portfolio

### GET /api/portfolio → 200 🔒
```json
{ "portfolio": {
    "total": 118432.55, "cash": 22140.10, "invested": 96292.45,
    "deposited": 100000, "unrealized": 14210.33, "unrealizedPct": 17.31,
    "totalReturn": 18432.55, "totalReturnPct": 18.43,
    "positions": [
      { "symbol": "NVDA", "qty": 120, "avgCost": 96.55, "price": 128.63,
        "value": 15435.60, "unrealized": 3849.60, "unrealizedPct": 33.23 }
    ] } }
```

### POST /api/orders → 201 🔒
```json
{ "side": "buy", "symbol": "AAPL", "qty": 10 }
```
Executes at the server-fetched market price. Returns `{ execution, portfolio }`.
No `price` field is accepted.

### POST /api/cash/deposits → 201 🔒
`{ "amount": 5000 }` → `{ transaction, portfolio }`

### GET /api/transactions?limit=100 → 200 🔒
`{ "transactions": [ { "id", "type", "symbol", "qty", "price", "amount", "realized", "createdAt" } ] }`

## Market data

Every US-listed stock and ETF is tradable. The symbol table is pulled from the
quote provider at boot and cached in SQLite, so search costs no vendor quota.

### GET /api/market/instruments → 200
Popular symbols for the empty search state. Not a restriction on what can be traded.

### GET /api/market/search?q=appl → 200
`{ "results": [ { "symbol", "name", "kind", "exchange" } ] }` — local symbol table
first, vendor search as fallback. Max 12.

### GET /api/market/instruments/:symbol → 200
```json
{ "instrument": { "symbol", "name", "kind", "sector", "exchange", "logo",
                  "mktCap", "peRatio", "divYield", "weekHigh52", "weekLow52" },
  "quote": { "symbol", "price", "previousClose", "change", "changePct", "at" } }
```

### GET /api/market/quotes?symbols=AAPL,MSFT,VOO → 200
Batched: `{ "quotes": { "AAPL": { … }, "MSFT": { … } } }`. Symbols that fail to
resolve are omitted rather than failing the request. Prefer this over the single
form when refreshing a watchlist.

### GET /api/market/quotes/:symbol → 200
`{ "quote": { "symbol", "price", "previousClose", "change", "changePct", "at" } }`

### GET /api/market/history/:symbol?range=1M → 200
Closing prices for the line chart — no OHLC. `range` ∈ `1D 1W 1M 3M 1Y 5Y`.
`{ "history": { "symbol", "range", "granularity", "points": [{ "t", "price" }] } }`

### GET /api/stream/quotes?symbols=AAPL,MSFT&token=<jwt> → 200 (text/event-stream)
Server-sent events. One `quote` event per price update:

```
retry: 5000

event: quote
data: {"symbol":"AAPL","price":227.61,"previousClose":226.80,"change":0.81,"changePct":0.36,"at":1721920412000}
```

The token travels as a query parameter because `EventSource` cannot set headers;
it is verified exactly like a bearer token. Max 60 symbols. Comment frames
(`: ping`) every 25s keep proxies from closing an idle connection. The server
relays a single upstream vendor socket to all connections, reference-counting
symbols so it only subscribes to what someone is watching.

### GET /health → 200
`{ "ok": true, "storage": "postgres", "quotes": "finnhub", "history": "twelvedata", "stream": "finnhub-socket" }`

## Watchlist 🔒

`GET /api/watchlist` → `{ "symbols": ["NVDA", "VOO"] }`
`PUT /api/watchlist` with `{ "symbols": [...] }` replaces the list (order preserved, max 50).
