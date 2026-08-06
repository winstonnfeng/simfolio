import { toUser } from './rowMappers.js';

/** @implements {import('../../domain/ports.js').UserRepository} */
export class SqliteUserRepository {
  constructor({ db }) {
    this.db = db;
  }

  async create(user) {
    this.db
      .prepare('INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(user.id, user.name, user.email, user.passwordHash, user.createdAt);
    return user;
  }

  async findByEmail(email) {
    return toUser(this.db.prepare('SELECT * FROM users WHERE email = ?').get(email));
  }

  async findById(id) {
    return toUser(this.db.prepare('SELECT * FROM users WHERE id = ?').get(id));
  }
}
