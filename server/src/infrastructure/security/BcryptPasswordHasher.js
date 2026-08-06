import bcrypt from 'bcryptjs';

export class BcryptPasswordHasher {
  constructor(rounds = 10) {
    this.rounds = rounds;
  }

  hash(plain) {
    return bcrypt.hash(plain, this.rounds);
  }

  verify(plain, hash) {
    return bcrypt.compare(plain, hash);
  }
}
