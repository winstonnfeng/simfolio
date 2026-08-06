/**
 * Time is a dependency, not an ambient fact. The domain never calls Date.now()
 * itself; use cases pass a timestamp obtained from an injected Clock, which
 * makes every trade rule deterministic under test.
 */

export class SystemClock {
  now() {
    return Date.now();
  }
}

export class FixedClock {
  constructor(startMs = 0) {
    this.current = startMs;
  }

  now() {
    return this.current;
  }

  advance(ms) {
    this.current += ms;
    return this.current;
  }
}
