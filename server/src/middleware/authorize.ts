import type { RequestHandler } from "express";
import type { Role } from "../../generated/prisma/client.js";
import { AppError } from "../utils/AppError.js";
import { ERROR_CODES, ERROR_MESSAGES } from "../constants/errors.js";
import { getAuthUser } from "../utils/request.js";

/**
 * Restrict a route to the given role(s). Must run AFTER `authenticate`
 * (it relies on req.user). Returns 401 if unauthenticated, 403 if the role is
 * not permitted.
 *
 *   router.get("/users", authenticate, requireRole("ADMIN"), controller.list)
 */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    const user = getAuthUser(req);
    if (!roles.includes(user.role)) {
      throw AppError.forbidden(ERROR_MESSAGES.FORBIDDEN, ERROR_CODES.FORBIDDEN);
    }
    next();
  };
}
