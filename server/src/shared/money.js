/** Money is stored and computed in integer cents. Never floats in the domain. */

export function toCents(dollars) {
  return Math.round(Number(dollars) * 100);
}

export function toDollars(cents) {
  return Math.round(Number(cents)) / 100;
}

export function multiplyCents(cents, quantity) {
  return Math.round(cents * quantity);
}
