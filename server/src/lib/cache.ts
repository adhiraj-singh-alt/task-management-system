import { env } from "../config/env.js";
import { logger } from "./logger.js";
import { getRedis } from "./redis.js";

/**
 * Generic cache-aside helpers over Redis. Every function is wrapped so a missing
 * or unreachable Redis never throws into callers: reads degrade to a miss and
 * writes/invalidations are swallowed (logged at debug). When caching is disabled
 * (`getRedis()` returns null) these are immediate no-ops.
 */

/** Read and JSON-parse a cached value, or null on miss / any error. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch (err) {
    logger.debug({ err, key }, "cacheGet failed");
    return null;
  }
}

/** JSON-serialize and store a value with a TTL (defaults to CACHE_TTL_SECONDS). */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number = env.CACHE_TTL_SECONDS,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    logger.debug({ err, key }, "cacheSet failed");
  }
}

/** Delete one or more keys. */
export async function cacheDel(...keys: string[]): Promise<void> {
  const redis = getRedis();
  if (!redis || keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch (err) {
    logger.debug({ err, keys }, "cacheDel failed");
  }
}

/**
 * Read the current generation counter for a namespace. A missing counter (or any
 * error) is treated as 0, so the first read uses `v0` and the first mutation's
 * INCR (→ 1) supersedes it. Version counters are never given a TTL.
 */
export async function getVersion(ns: string): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  try {
    const raw = await redis.get(ns);
    const n = raw === null ? 0 : Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch (err) {
    logger.debug({ err, ns }, "getVersion failed");
    return 0;
  }
}

/**
 * Bump a namespace's generation counter, invalidating every data key that embeds
 * the old version (they orphan and expire by TTL). INCR auto-initializes a
 * missing key to 0 then returns 1, so no seeding is needed.
 */
export async function bumpVersion(ns: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.incr(ns);
  } catch (err) {
    logger.debug({ err, ns }, "bumpVersion failed");
  }
}

/**
 * Cache-aside wrapper: return the cached value for `key` on a hit, otherwise run
 * `loader()`, best-effort cache its result, and return it. Any Redis failure
 * falls through to `loader()` so correctness never depends on the cache.
 *
 * `onOutcome`, if given, is invoked synchronously with the hit/miss result so
 * callers can record metrics. It must not throw or block — it runs in the read
 * path.
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
  onOutcome?: (hit: boolean) => void,
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    logger.debug({ key }, "cache hit");
    onOutcome?.(true);
    return cached;
  }
  logger.debug({ key }, "cache miss");
  onOutcome?.(false);
  const value = await loader();
  await cacheSet(key, value, ttlSeconds);
  return value;
}
