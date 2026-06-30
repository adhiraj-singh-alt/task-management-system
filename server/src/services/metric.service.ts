import { AUDIT_ACTIONS } from "../constants/audit.js";
import { prisma } from "../lib/prisma.js";

/**
 * Cache effectiveness, derived from the hit/miss rows written to `audit_logs`
 * by `recordCacheOutcome`. One grouped count over the two cache actions; ratios
 * are 0 when nothing has been recorded yet (avoids divide-by-zero).
 */
export async function getCacheMetrics(): Promise<{
  hits: number;
  misses: number;
  total: number;
  hitRatio: number;
  missRatio: number;
}> {
  const grouped = await prisma.audit_logs.groupBy({
    by: ["action"],
    where: { action: { in: [AUDIT_ACTIONS.CACHE_HIT, AUDIT_ACTIONS.CACHE_MISS] } },
    _count: { _all: true },
  });

  let hits = 0;
  let misses = 0;
  for (const row of grouped) {
    if (row.action === AUDIT_ACTIONS.CACHE_HIT) hits = row._count._all;
    else if (row.action === AUDIT_ACTIONS.CACHE_MISS) misses = row._count._all;
  }

  const total = hits + misses;
  return {
    hits,
    misses,
    total,
    hitRatio: total === 0 ? 0 : hits / total,
    missRatio: total === 0 ? 0 : misses / total,
  };
}
