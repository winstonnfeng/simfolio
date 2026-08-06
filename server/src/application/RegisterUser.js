import { ConflictError, ValidationError } from '../domain/errors.js';
import { createPortfolio } from '../domain/portfolio.js';

export class RegisterUser {
  constructor({ users, portfolios, passwordHasher, tokens, ids, clock, startingCashCents }) {
    this.users = users;
    this.portfolios = portfolios;
    this.passwordHasher = passwordHasher;
    this.tokens = tokens;
    this.ids = ids;
    this.clock = clock;
    this.startingCashCents = startingCashCents;
  }

  async execute({ name, email, password }) {
    const displayName = String(name ?? '').trim();
    const normalisedEmail = String(email ?? '').trim().toLowerCase();
    if (!displayName || !normalisedEmail) throw new ValidationError('Name and email are required');
    if (String(password ?? '').length < 6) throw new ValidationError('Password must be at least 6 characters');
    if (await this.users.findByEmail(normalisedEmail)) throw new ConflictError('An account already exists for that email');

    const user = await this.users.create({
      id: this.ids.next(),
      name: displayName,
      email: normalisedEmail,
      passwordHash: await this.passwordHasher.hash(password),
      createdAt: this.clock.now(),
    });

    await this.portfolios.create(user.id, createPortfolio(this.startingCashCents));

    return {
      user: { id: user.id, name: user.name, email: user.email },
      token: this.tokens.sign({ sub: user.id, email: user.email }),
    };
  }
}
