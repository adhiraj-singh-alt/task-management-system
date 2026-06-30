import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { AppError } from "../utils/AppError.js";
import { ERROR_CODES, ERROR_MESSAGES } from "../constants/errors.js";

type Source = "body" | "params" | "query";

/**
 * Build a middleware that validates one part of the request against a zod
 * schema. The parsed (typed, stripped) result is stored on `req.validated[source]`
 * for the controller to read — we don't write back to `req[source]` because
 * Express 5 makes `req.query` read-only. On failure it throws a 400 AppError
 * that flows through the central error handler.
 *
 * Usage: validate(bodySchema)  |  validate(idParamSchema, "params")
 */
export function validate(schema: ZodType, source: Source = "body"): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const first = result.error.issues[0];
      const message = first
        ? `${first.path.join(".") || source}: ${first.message}`
        : ERROR_MESSAGES.VALIDATION_ERROR;
      throw AppError.badRequest(message, ERROR_CODES.VALIDATION_ERROR);
    }
    req.validated ??= {};
    req.validated[source] = result.data;
    next();
  };
}
