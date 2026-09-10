export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, "VALIDATION_ERROR", message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, "NOT_FOUND", `No se encontró: ${resource}`);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, "CONFLICT", message);
  }
}

/** 401: no hay sesion valida (falta el token o es invalido/expiro). */
export class UnauthorizedError extends AppError {
  constructor(message = "No autorizado") {
    super(401, "UNAUTHORIZED", message);
  }
}

/** 403: hay sesion valida, pero el rol o el tenant no tiene permiso. */
export class ForbiddenError extends AppError {
  constructor(message = "No tienes permiso para esta accion") {
    super(403, "FORBIDDEN", message);
  }
}
