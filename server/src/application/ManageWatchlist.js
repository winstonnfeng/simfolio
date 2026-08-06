import { normalizeSymbols } from '../domain/Symbol.js';

export class ManageWatchlist {
  constructor({ watchlists }) {
    this.watchlists = watchlists;
  }

  list({ userId }) {
    return this.watchlists.list(userId);
  }

  replace({ userId, symbols }) {
    return this.watchlists.replace(userId, normalizeSymbols(symbols));
  }
}
