import jwt from 'jsonwebtoken';
import { AuthError } from '../../domain/errors.js';

export class JwtTokenService {
  constructor({ secret, expiresIn }) {
    this.secret = secret;
    this.expiresIn = expiresIn;
  }

  sign(payload) {
    return jwt.sign(payload, this.secret, { expiresIn: this.expiresIn });
  }

  verify(token) {
    try {
      return jwt.verify(token, this.secret);
    } catch (error) {
      throw new AuthError('Session expired — please sign in again');
    }
  }
}
