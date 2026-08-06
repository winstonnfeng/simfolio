import { AuthError } from '../domain/errors.js';

export class LoginUser {
  constructor({ users, passwordHasher, tokens }) {
    this.users = users;
    this.passwordHasher = passwordHasher;
    this.tokens = tokens;
  }

  async execute({ email, password }) {
    const user = await this.users.findByEmail(String(email ?? '').trim().toLowerCase());
    // Same message either way so the endpoint cannot be used to enumerate accounts.
    if (!user) throw new AuthError('Email or password is incorrect');
    if (!(await this.passwordHasher.verify(String(password ?? ''), user.passwordHash))) {
      throw new AuthError('Email or password is incorrect');
    }
    return {
      user: { id: user.id, name: user.name, email: user.email },
      token: this.tokens.sign({ sub: user.id, email: user.email }),
    };
  }
}
