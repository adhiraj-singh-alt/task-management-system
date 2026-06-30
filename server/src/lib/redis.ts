import { Redis } from "ioredis";
import { cacheEnabled, env, isProduction } from "../config/env.js";
import { logger } from "./logger.js";

/**
 * Single shared ioredis client, mirroring src/lib/prisma.ts: cached on
 * `globalThis` in non-production so `tsx watch` hot reloads don't open a new
 * connection on every change.
 *
 * Caching is best-effort. The client is configured to fail commands fast (rather
 * than queue/hang) when Redis is unreachable, so callers in src/lib/cache.ts can
 * treat any error as a cache miss and the app keeps working without Redis.
 */
const globalForRedis = globalThis as unknown as { redis?: Redis | null };

function createRedisClient(): Redis | null {
  // No URL / disabled => never construct a client; getRedis() stays null and all
  // cache operations become no-ops.
  if (!cacheEnabled || !env.REDIS_URL) {
    return null;
  }

  const client = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });

  // Surface connection problems without spamming: log at most once until the
  // next successful (re)connect.
  let errorLogged = false;
  client.on("error", (err) => {
    if (!errorLogged) {
      errorLogged = true;
      logger.warn({ err }, "Redis cache error — falling back to uncached reads");
    }
  });
  client.on("ready", () => {
    errorLogged = false;
  });

  return client;
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (!isProduction) {
  globalForRedis.redis = redis;
}

/** The shared client, or null when caching is disabled. */
export function getRedis(): Redis | null {
  return redis;
}

/** Close the Redis connection during graceful shutdown. Safe to call when disabled. */
export async function disconnectRedis(): Promise<void> {
  if (!redis) return;
  try {
    await redis.quit();
  } catch {
    // Best-effort; force-close if a graceful quit fails.
    redis.disconnect();
  }
}
