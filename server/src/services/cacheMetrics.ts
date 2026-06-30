import { AUDIT_ACTIONS } from "../constants/audit.js";
import { prisma } from "../lib/prisma.js";
import { getRedis } from "../lib/redis.js";
import { logger } from "../lib/logger.js";

/**
 * Records cache hit/miss outcomes into `audit_logs` so the metrics endpoint can
 * compute a hit ratio. Best-effort and fire-and-forget: it never awaits the
 * write into the read path and never throws, so a failed insert can't affect the
 * request that triggered it (same contract as cache invalidation).
 *
 * Recording is skipped entirely when Redis is off (`getRedis()` is null): with
 * no cache every read is a forced miss, so logging it would be meaningless write
 * amplification — and it keeps tests / Redis-less dev untouched.
 */
export function recordCacheOutcome(
  userId: string,
  taskId: string | null,
): (hit: boolean) => void {
  return (hit: boolean): void => {
    if (!getRedis()) return;
    void prisma.audit_logs
      .create({
        data: {
          userId,
          taskId,
          action: hit ? AUDIT_ACTIONS.CACHE_HIT : AUDIT_ACTIONS.CACHE_MISS,
        },
      })
      .catch((err) => logger.debug({ err }, "recordCacheOutcome failed"));
  };
}
