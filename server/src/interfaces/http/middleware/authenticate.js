import { AuthError } from '../../../domain/errors.js';

export function authenticate(tokens) {
  return (req, _res, next) => {
    try {
      const header = req.headers.authorization ?? '';
      const [scheme, token] = header.split(' ');
      if (scheme !== 'Bearer' || !token) throw new AuthError('Missing bearer token');
      const payload = tokens.verify(token);
      req.userId = payload.sub;
      next();
    } catch (error) {
      next(error);
    }
  };
}
