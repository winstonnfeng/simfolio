import { PG, toUser } from './rowMappers.js';

/** @implements {import('../../domain/ports.js').UserRepository} */
export class PgUserRepository {
  constructor({ db }) {
    this.db = db;
  }

  async create(user) {
    await this.db.query(
      'INSERT INTO users (id, name, email, password_hash, created_at) VALUES ($1, $2, $3, $4, to_timestamp($5 / 1000.0))',
      [user.id, user.name, user.email, user.passwordHash, user.createdAt]
    );
    return user;
  }

  async findByEmail(email) {
    const { rows } = await this.db.query('SELECT * FROM users WHERE lower(email) = lower($1)', [email]);
    return toUser(rows[0], PG);
  }

  async findById(id) {
    const { rows } = await this.db.query('SELECT * FROM users WHERE id = $1', [id]);
    return toUser(rows[0], PG);
  }
}
