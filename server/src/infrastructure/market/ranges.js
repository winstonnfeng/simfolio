/** Chart ranges, mapped per provider. */
export const RANGES = {
  '1D': { days: 1, twelveData: { interval: '5min', outputsize: 78 } },
  '1W': { days: 7, twelveData: { interval: '30min', outputsize: 70 } },
  '1M': { days: 31, twelveData: { interval: '1day', outputsize: 23 } },
  '3M': { days: 92, twelveData: { interval: '1day', outputsize: 66 } },
  '1Y': { days: 366, twelveData: { interval: '1week', outputsize: 53 } },
  '5Y': { days: 1830, twelveData: { interval: '1month', outputsize: 61 } },
};

export const RANGE_IDS = Object.keys(RANGES);

export function rangeOf(id) {
  return RANGES[id] ?? RANGES['1M'];
}

/** Symbols shown before the user searches. Not a restriction on what can be traded. */
export const POPULAR_SYMBOLS = [
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'JPM', 'KO', 'COST',
  'VOO', 'QQQ', 'VTI', 'SCHD',
  'SHOP.TO', 'RY.TO', 'TD.TO', 'ENB.TO', 'CNR.TO', 'CNQ.TO', 'BCE.TO', 'XIU.TO',
];
