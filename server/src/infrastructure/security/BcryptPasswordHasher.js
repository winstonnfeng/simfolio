import bcrypt from 'bcryptjs';

/**
 * PasswordHasher port, backed by bcrypt.
 *
 * The cost factor is injected rather than hard-coded: tests want it low so they
 * run fast, production wants it high enough to be slow on purpose.
 *
 * @implements {import('../../domain/ports.js').PasswordHasher}
 */
export class BcryptPasswordHasher {
  constructor({ rounds = 10 } = {}) {
    this.rounds = rounds;
  }

  hash(plain) {
    return bcrypt.hash(plain, this.rounds);
  }

  verify(plain, hash) {
    return bcrypt.compare(plain, hash);
  }
}
