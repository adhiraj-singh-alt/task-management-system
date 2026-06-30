import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { disconnectRedis, getRedis } from "./lib/redis.js";
import { logger } from "./lib/logger.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(
    `🚀 TaskFlow API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`,
  );
});

// Warm the Redis connection (lazyConnect) so any misconfiguration surfaces in the
// logs at boot rather than on the first cached read. Failure is non-fatal —
// caching degrades to a no-op.
void getRedis()?.connect().catch(() => {
  /* the client's "error" handler logs; reads fall back to the DB */
});

/** Drain connections and close the DB and cache pools on shutdown signals. */
async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received — shutting down gracefully...`);
  server.close(() => {
    void Promise.allSettled([prisma.$disconnect(), disconnectRedis()]).finally(
      () => process.exit(0),
    );
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
