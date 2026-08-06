import { ValidationError } from '../../../domain/errors.js';

/** Validates req.body against a zod schema and replaces it with the parsed value. */
export function validateBody(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(new ValidationError('Request body is invalid', result.error.flatten().fieldErrors));
    }
    req.body = result.data;
    next();
  };
}
