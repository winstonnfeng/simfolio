// Presentation-layer formatters. Pure functions, no state, no DOM.

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

export function money(v) {
  return usd.format(Number(v) || 0);
}

export function moneyRound(v) {
  return usd0.format(Number(v) || 0);
}

export function signedMoney(v) {
  const n = Number(v) || 0;
  return (n >= 0 ? '+' : '−') + usd.format(Math.abs(n)).replace('-', '');
}

export function signedPercent(v) {
  const n = Number(v) || 0;
  return (n >= 0 ? '+' : '−') + num.format(Math.abs(n)) + '%';
}

export function quantity(v) {
  const n = Number(v) || 0;
  return Number.isInteger(n) ? String(n) : num.format(n);
}

export function compact(v) {
  const n = Math.abs(Number(v) || 0);
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return num.format(n);
}

export function dateTime(ts) {
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function dateOnly(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
