/**
 * TokenStore — where the session token lives.
 *
 * A class rather than three module-level functions so the gateway can be handed
 * one in a test (or a memory-backed one in a private-mode browser) instead of
 * reaching for a global. Every method swallows storage errors: a browser with
 * storage disabled should degrade to a session that ends on refresh, not crash.
 */
export class LocalTokenStore {
  constructor({ key = 'paperTrader.v1.token', storage = globalThis.localStorage } = {}) {
    this.key = key;
    this.storage = storage;
  }

  read() {
    try {
      return this.storage?.getItem(this.key) ?? null;
    } catch (error) {
      return null;
    }
  }

  write(token) {
    try {
      this.storage?.setItem(this.key, token);
    } catch (error) {
      /* storage unavailable — the token stays in memory for this session */
    }
  }

  clear() {
    try {
      this.storage?.removeItem(this.key);
    } catch (error) {
      /* noop */
    }
  }
}

/** Same contract, nothing persisted. */
export class MemoryTokenStore {
  constructor() {
    this.token = null;
  }

  read() {
    return this.token;
  }

  write(token) {
    this.token = token;
  }

  clear() {
    this.token = null;
  }
}
