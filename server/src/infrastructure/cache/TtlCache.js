/**
 * Time-to-live cache with in-flight de-duplication: N concurrent requests for
 * the same key produce exactly one call to the loader. Both halves matter on a
 * free API tier, and neither belongs inside a vendor adapter — so they live
 * here and are composed in.
 */
export class TtlCache {
  constructor({ clock, defaultTtlMs = 15_000 }) {
    this.clock = clock;
    this.defaultTtlMs = defaultTtlMs;
    this.entries = new Map();
    this.inFlight = new Map();
  }

  /** Cached value if still fresh, otherwise null. Never triggers a load. */
  peek(key) {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (this.clock.now() - entry.at >= entry.ttl) {
      this.entries.delete(key);
      return null;
    }
    return entry.value;
  }

  async resolve(key, load, ttlMs = this.defaultTtlMs) {
    const fresh = this.peek(key);
    if (fresh !== null) return fresh;

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const promise = load()
      .then((value) => {
        this.entries.set(key, { at: this.clock.now(), value, ttl: ttlMs });
        return value;
      })
      .finally(() => this.inFlight.delete(key));

    this.inFlight.set(key, promise);
    return promise;
  }

  clear() {
    this.entries.clear();
    this.inFlight.clear();
  }
}
