/**
 * Operational error — a problem we anticipated and can describe to the client
 * (bad input, missing resource, auth failure). The central error handler sends
 * these as structured JSON. Anything that is NOT an AppError is treated as an
 * unexpected bug and reported as a generic 500.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string | undefined;
  readonly isOperational = true;

  constructor(message: string, statusCode = 500, code?: string) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message: string, code = "BAD_REQUEST"): AppError {
    return new AppError(message, 400, code);
  }
  static unauthorized(message = "Unauthorized", code = "UNAUTHORIZED"): AppError {
    return new AppError(message, 401, code);
  }
  static forbidden(message = "Forbidden", code = "FORBIDDEN"): AppError {
    return new AppError(message, 403, code);
  }
  static notFound(message = "Not found", code = "NOT_FOUND"): AppError {
    return new AppError(message, 404, code);
  }
  static conflict(message: string, code = "CONFLICT"): AppError {
    return new AppError(message, 409, code);
  }
  static tooManyRequests(
    message = "Too many requests",
    code = "TOO_MANY_REQUESTS",
  ): AppError {
    return new AppError(message, 429, code);
  }
}
