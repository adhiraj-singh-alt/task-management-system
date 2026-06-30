import type { Request } from "express";
import type { Role } from "../../generated/prisma/client.js";
import { AppError } from "./AppError.js";
import { ERROR_CODES, ERROR_MESSAGES } from "../constants/errors.js";

type Source = "body" | "params" | "query";

/**
 * Typed accessor for data placed on `req.validated` by the `validate` middleware.
 * Only call for a source that actually ran through `validate`.
 */
export function validated<T>(req: Request, source: Source = "body"): T {
  return req.validated?.[source] as T;
}

/**
 * Return the authenticated principal, or throw 401 if absent. Lets handlers
 * behind `authenticate` (and RBAC, later) avoid the `req.user!` assertion.
 */
export function getAuthUser(req: Request): { id: string; role: Role } {
  if (!req.user) {
    throw AppError.unauthorized(ERROR_MESSAGES.MISSING_TOKEN, ERROR_CODES.MISSING_TOKEN);
  }
  return req.user;
}
