/**
 * Audit log action identifiers. Stored verbatim in `audit_logs.action`, so keep
 * the string values stable — the metrics endpoint aggregates on them. Add new
 * audit actions here rather than inlining literals at call sites.
 */
export const AUDIT_ACTIONS = {
  CACHE_HIT: "cache_hit",
  CACHE_MISS: "cache_miss",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
