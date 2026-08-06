// Market data layer: instrument catalogue, deterministic history generation,
// and a live price feed. Knows nothing about portfolios or the UI.

export const INSTRUMENTS = [
  { symbol: 'AAPL', name: 'Apple Inc.', kind: 'Stock', sector: 'Technology', price: 227.42, mktCap: 3.44e12, peRatio: 34.6, divYield: 0.44, volume: 48_200_000 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', kind: 'Stock', sector: 'Technology', price: 441.18, mktCap: 3.28e12, peRatio: 36.1, divYield: 0.68, volume: 19_400_000 },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', kind: 'Stock', sector: 'Semiconductors', price: 128.63, mktCap: 3.16e12, peRatio: 52.4, divYield: 0.03, volume: 246_000_000 },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', kind: 'Stock', sector: 'Consumer', price: 197.85, mktCap: 2.07e12, peRatio: 41.2, divYield: 0, volume: 33_100_000 },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', kind: 'Stock', sector: 'Technology', price: 178.34, mktCap: 2.18e12, peRatio: 24.8, divYield: 0.45, volume: 24_700_000 },
  { symbol: 'TSLA', name: 'Tesla Inc.', kind: 'Stock', sector: 'Automotive', price: 246.91, mktCap: 7.88e11, peRatio: 61.9, divYield: 0, volume: 89_500_000 },
  { symbol: 'META', name: 'Meta Platforms', kind: 'Stock', sector: 'Technology', price: 563.27, mktCap: 1.42e12, peRatio: 27.3, divYield: 0.35, volume: 13_800_000 },
  { symbol: 'JPM', name: 'JPMorgan Chase', kind: 'Stock', sector: 'Financials', price: 214.06, mktCap: 6.02e11, peRatio: 12.1, divYield: 2.14, volume: 8_600_000 },
  { symbol: 'KO', name: 'Coca-Cola Co.', kind: 'Stock', sector: 'Consumer', price: 71.48, mktCap: 3.08e11, peRatio: 26.4, divYield: 2.71, volume: 14_200_000 },
  { symbol: 'COST', name: 'Costco Wholesale', kind: 'Stock', sector: 'Consumer', price: 884.55, mktCap: 3.92e11, peRatio: 53.8, divYield: 0.51, volume: 2_100_000 },
  { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', kind: 'ETF', sector: 'Broad market', price: 512.36, mktCap: 5.31e11, peRatio: 25.9, divYield: 1.28, volume: 4_900_000 },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', kind: 'ETF', sector: 'Nasdaq 100', price: 479.12, mktCap: 2.94e11, peRatio: 32.7, divYield: 0.58, volume: 31_400_000 },
  { symbol: 'VTI', name: 'Vanguard Total Market', kind: 'ETF', sector: 'Broad market', price: 281.74, mktCap: 4.18e11, peRatio: 24.6, divYield: 1.31, volume: 3_300_000 },
  { symbol: 'SCHD', name: 'Schwab US Dividend', kind: 'ETF', sector: 'Dividend', price: 82.91, mktCap: 6.14e10, peRatio: 16.2, divYield: 3.42, volume: 5_700_000 },
  { symbol: 'SHOP.TO', name: 'Shopify Inc.', kind: 'Stock', sector: 'Technology', price: 148.32, mktCap: 1.91e11, peRatio: 71.4, divYield: 0, volume: 2_400_000 },
  { symbol: 'RY.TO', name: 'Royal Bank of Canada', kind: 'Stock', sector: 'Financials', price: 168.44, mktCap: 2.37e11, peRatio: 13.8, divYield: 3.36, volume: 3_100_000 },
  { symbol: 'TD.TO', name: 'Toronto-Dominion Bank', kind: 'Stock', sector: 'Financials', price: 78.21, mktCap: 1.37e11, peRatio: 11.2, divYield: 5.24, volume: 8_900_000 },
  { symbol: 'ENB.TO', name: 'Enbridge Inc.', kind: 'Stock', sector: 'Energy', price: 59.87, mktCap: 1.3e11, peRatio: 21.6, divYield: 6.12, volume: 6_700_000 },
  { symbol: 'CNR.TO', name: 'Canadian National Railway', kind: 'Stock', sector: 'Industrials', price: 152.6, mktCap: 9.6e10, peRatio: 19.4, divYield: 2.21, volume: 1_800_000 },
  { symbol: 'CNQ.TO', name: 'Canadian Natural Resources', kind: 'Stock', sector: 'Energy', price: 44.72, mktCap: 9.4e10, peRatio: 12.7, divYield: 4.75, volume: 9_200_000 },
  { symbol: 'BCE.TO', name: 'BCE Inc.', kind: 'Stock', sector: 'Telecom', price: 33.15, mktCap: 3.03e10, peRatio: 17.9, divYield: 8.41, volume: 5_400_000 },
  { symbol: 'XIU.TO', name: 'iShares S&P/TSX 60 ETF', kind: 'ETF', sector: 'Broad market', price: 38.94, mktCap: 1.42e10, peRatio: 17.1, divYield: 2.86, volume: 2_600_000 },
];

export const RANGES = [
  { id: '1D', label: '1D', points: 78, vol: 0.0022, drift: 0.00004 },
  { id: '1W', label: '1W', points: 70, vol: 0.0048, drift: 0.00009 },
  { id: '1M', label: '1M', points: 66, vol: 0.0079, drift: 0.00012 },
  { id: '3M', label: '3M', points: 72, vol: 0.0121, drift: 0.00021 },
  { id: '1Y', label: '1Y', points: 84, vol: 0.0186, drift: 0.00042 },
  { id: '5Y', label: '5Y', points: 90, vol: 0.0325, drift: 0.00118 },
];

export function findInstrument(symbol) {
  return INSTRUMENTS.find((i) => i.symbol === symbol) || null;
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Deterministic close series for a symbol + range. The final point always
 * equals `endPrice`, so live quotes and history stay consistent.
 */
export function buildSeries(symbol, rangeId, endPrice) {
  const range = RANGES.find((r) => r.id === rangeId) || RANGES[0];
  const rand = seededRandom(hashString(symbol + rangeId));
  const n = range.points;
  const steps = [];
  for (let i = 0; i < n; i++) {
    const shock = (rand() - 0.5) * 2 * range.vol;
    const wave = Math.sin((i / n) * Math.PI * (1.5 + rand() * 0.5)) * range.vol * 0.6;
    steps.push(1 + shock + wave + range.drift);
  }
  // Walk backwards from the current price so the series ends exactly on it.
  const out = new Array(n);
  out[n - 1] = endPrice;
  for (let i = n - 2; i >= 0; i--) out[i] = out[i + 1] / steps[i + 1];
  return out;
}

/**
 * Live feed: random-walk ticks over the catalogue. Subscribers get a
 * `{ symbol: price }` map. Deterministic seed keeps sessions comparable.
 */
export class PriceFeed {
  constructor(instruments = INSTRUMENTS, intervalMs = 2400) {
    this.intervalMs = intervalMs;
    this.listeners = new Set();
    this.prices = {};
    this.opens = {};
    this.rand = seededRandom(hashString('paper-trader-feed'));
    instruments.forEach((i) => {
      this.prices[i.symbol] = i.price;
      // Yesterday's close, derived deterministically for a stable day change.
      const drift = (hashString(i.symbol) % 400 - 190) / 10000;
      this.opens[i.symbol] = +(i.price / (1 + drift)).toFixed(2);
    });
    this.timer = null;
  }

  subscribe(fn) {
    this.listeners.add(fn);
    fn(this.prices);
    return () => this.listeners.delete(fn);
  }

  tick() {
    const next = { ...this.prices };
    Object.keys(next).forEach((sym) => {
      const vol = 0.0018 + (hashString(sym) % 25) / 10000;
      const move = (this.rand() - 0.495) * 2 * vol;
      next[sym] = Math.max(0.5, +(next[sym] * (1 + move)).toFixed(2));
    });
    this.prices = next;
    this.listeners.forEach((fn) => fn(next));
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), this.intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  dayChange(symbol) {
    const open = this.opens[symbol];
    const price = this.prices[symbol];
    if (!open || !price) return { abs: 0, pct: 0 };
    return { abs: price - open, pct: ((price - open) / open) * 100 };
  }
}
