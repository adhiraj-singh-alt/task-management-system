import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { apiRouter } from "./routes/index.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";

/**
 * Build the Express application. Kept separate from server startup so tests can
 * import the app (Supertest) without binding a port.
 */
export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");

  // Per-request logging (adds req.log + req.id) — first so it captures everything.
  // Custom serializers log only method/url/status: headers (which carry the
  // Authorization bearer token and refresh-token cookie) are never serialized,
  // so credentials can't leak into logs.
  app.use(
    pinoHttp({
      logger,
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );

  // Security headers + CORS + body/cookie parsing.
  app.use(helmet());
  app.use(
    cors({
      // `origin: true` reflects the request origin, which is valid alongside
      // credentials. Production should set an explicit CORS_ORIGIN — credentialed
      // cookies cannot be used with a wildcard "*" origin.
      origin:
        env.CORS_ORIGIN === "*"
          ? true
          : env.CORS_ORIGIN.split(",").map((o) => o.trim()),
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  // All feature routers, aggregated in routes/index.ts.
  app.use(apiRouter);

  // 404 + central error handler — always last.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
