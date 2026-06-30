import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";
import { verifyAccessToken } from "../services/token.service.js";
import { ERROR_CODES, ERROR_MESSAGES } from "../constants/errors.js";

/**
 * Require a valid Bearer access token. Verifies the JWT, confirms the user still
 * exists (so deleted users and role changes take effect immediately), and
 * attaches `{ id, role }` to `req.user` for downstream handlers / RBAC.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw AppError.unauthorized(ERROR_MESSAGES.MISSING_TOKEN, ERROR_CODES.MISSING_TOKEN);
  }

  const payload = verifyAccessToken(header.slice("Bearer ".length).trim());

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true },
  });
  if (!user) {
    throw AppError.unauthorized(ERROR_MESSAGES.USER_NOT_FOUND, ERROR_CODES.USER_NOT_FOUND);
  }

  req.user = { id: user.id, role: user.role };
  next();
};
