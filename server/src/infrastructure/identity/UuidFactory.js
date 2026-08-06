import { randomUUID } from 'node:crypto';

/** IdFactory port. Injected so use cases can be asserted against fixed ids. */
export class UuidFactory {
  next() {
    return randomUUID();
  }
}
