import type { Role } from "../../generated/prisma/client.js";
import type { Logger } from "pino";

/**
 * Augment Express's Request with our request-scoped extras:
 * - `user`     — the authenticated principal (set by `authenticate`).
 * - `validated`— parsed/validated inputs (set by the `validate` middleware);
 *                a bag because Express 5 makes `req.query` read-only.
 * - `log`/`id` — per-request child logger + id (set by pino-http).
 */
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: Role };
      validated?: {
        body?: unknown;
        params?: unknown;
        query?: unknown;
      };
      log?: Logger;
      id?: string | number | object;
    }
  }
}

export {};
