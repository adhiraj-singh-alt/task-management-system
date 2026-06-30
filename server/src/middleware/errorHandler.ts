import type { ErrorRequestHandler } from "express";
import { AppError } from "../utils/AppError.js";
import { mapPrismaError } from "../utils/prismaError.js";
import { isProduction } from "../config/env.js";
import { logger } from "../lib/logger.js";

/**
 * Central error handler. Must be registered LAST. Express 5 forwards rejected
 * promises from async handlers here automatically, so route code can just throw.
 *
 * Response shape (stable contract for the whole API):
 *   { "error": { "message": string, "code"?: string } }
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // Operational errors and mapped Prisma errors are client-facing.
  const appError = err instanceof AppError ? err : mapPrismaError(err);

  if (appError) {
    res.status(appError.statusCode).json({
      error: {
        message: appError.message,
        ...(appError.code ? { code: appError.code } : {}),
      },
    });
    return;
  }

  // Unexpected — log the real error server-side (with request context if pino-http
  // attached a child logger), hide details from clients in production.
  (req.log ?? logger).error({ err }, "Unhandled error");
  const message =
    !isProduction && err instanceof Error ? err.message : "Internal server error";
  res.status(500).json({ error: { message, code: "INTERNAL_ERROR" } });
};
