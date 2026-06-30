import { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "./AppError.js";
import { ERROR_CODES, ERROR_MESSAGES } from "../constants/errors.js";

/**
 * Translate a known Prisma error into an AppError so it serializes through the
 * stable error contract instead of leaking as a generic 500. Returns null for
 * anything we don't deliberately map (handled as an unexpected 500 upstream).
 *
 * Codes: https://www.prisma.io/docs/orm/reference/error-reference
 */
export function mapPrismaError(err: unknown): AppError | null {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) {
    return null;
  }

  switch (err.code) {
    // Unique constraint violation.
    case "P2002":
      return AppError.conflict(
        ERROR_MESSAGES.RESOURCE_CONFLICT,
        ERROR_CODES.RESOURCE_CONFLICT,
      );
    // Record required by the operation was not found (e.g. update/delete miss).
    case "P2025":
      return AppError.notFound(
        ERROR_MESSAGES.RESOURCE_NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND,
      );
    // Foreign-key constraint failed.
    case "P2003":
      return AppError.badRequest(
        ERROR_MESSAGES.RELATED_RESOURCE_NOT_FOUND,
        ERROR_CODES.RELATED_RESOURCE_NOT_FOUND,
      );
    default:
      return null;
  }
}
