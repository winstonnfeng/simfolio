import { DomainError } from '../../../domain/errors.js';

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
}

export function errorHandler(error, _req, res, _next) {
  if (error instanceof DomainError) {
    return res.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details ?? undefined },
    });
  }
  console.error('[unhandled]', error);
  return res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
}
