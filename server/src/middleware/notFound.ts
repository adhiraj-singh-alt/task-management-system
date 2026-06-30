import type { RequestHandler } from "express";
import { AppError } from "../utils/AppError.js";

/**
 * Catches any request that didn't match a route and forwards a 404 AppError to
 * the central error handler. Register after all routes, before errorHandler.
 */
export const notFound: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};
