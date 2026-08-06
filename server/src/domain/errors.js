export class DomainError extends Error {
  constructor(message, code = 'DOMAIN_ERROR', status = 400) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.status = status;
  }
}

export class ValidationError extends DomainError {
  constructor(message, details = null) {
    super(message, 'VALIDATION_ERROR', 422);
    this.details = details;
  }
}

export class AuthError extends DomainError {
  constructor(message = 'Not authorised') {
    super(message, 'AUTH_ERROR', 401);
  }
}

export class ConflictError extends DomainError {
  constructor(message) {
    super(message, 'CONFLICT', 409);
  }
}

export class NotFoundError extends DomainError {
  constructor(message = 'Not found') {
    super(message, 'NOT_FOUND', 404);
  }
}

export class InsufficientFundsError extends DomainError {
  constructor(message = 'Not enough buying power for this order') {
    super(message, 'INSUFFICIENT_FUNDS', 422);
  }
}

export class InsufficientSharesError extends DomainError {
  constructor(message = 'You do not hold enough shares to sell') {
    super(message, 'INSUFFICIENT_SHARES', 422);
  }
}
