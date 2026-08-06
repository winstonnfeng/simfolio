import { ValidationError } from './errors.js';

const TICKER = /^[A-Z0-9.\-]{1,10}$/;

/**
 * Ticker normalisation lived in four places and drifted. It is one rule, so it
 * belongs to the domain: trim, upper-case, validate, or refuse.
 */
export function normalizeSymbol(raw) {
  const ticker = String(raw ?? '').trim().toUpperCase();
  if (!ticker) throw new ValidationError('Symbol is required');
  if (!TICKER.test(ticker)) throw new ValidationError(`"${raw}" is not a valid ticker`);
  return ticker;
}

/** Normalises a list, dropping blanks and duplicates while keeping order. */
export function normalizeSymbols(raw, { max = 60 } = {}) {
  const list = Array.isArray(raw) ? raw : String(raw ?? '').split(',');
  const seen = new Set();
  for (const entry of list) {
    if (String(entry ?? '').trim() === '') continue;
    seen.add(normalizeSymbol(entry));
    if (seen.size >= max) break;
  }
  return [...seen];
}
