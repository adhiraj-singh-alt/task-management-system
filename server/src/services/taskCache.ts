import { createHash } from "node:crypto";
import type { Role } from "../../generated/prisma/client.js";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { bumpVersion, getVersion, withCache } from "../lib/cache.js";
import { recordCacheOutcome } from "./cacheMetrics.js";
import type { ListTasksQuery } from "../validators/task.validator.js";

type AuthUser = { id: string; role: Role };

/**
 * Caching for task reads, with generation-counter invalidation.
 *
 * Scope mirrors `ownerScope`: a USER reads only their own rows (per-user version
 * namespace), while an ADMIN reads every user's rows (a single global namespace).
 * Data keys embed the current version, so bumping the counter on a mutation
 * orphans all prior keys at once — no SCAN, no key tracking.
 */

const userVersionNs = (userId: string): string => `v:tasks:u:${userId}`;
const GLOBAL_VERSION_NS = "v:tasks:all";

/** The (key-prefix scope, version namespace) a given reader caches under. */
function readScope(user: AuthUser): { scope: string; ns: string } {
  return user.role === "ADMIN"
    ? { scope: "all", ns: GLOBAL_VERSION_NS }
    : { scope: `u:${user.id}`, ns: userVersionNs(user.id) };
}

/**
 * Stable hash of the parsed/defaulted list query. Dates are coerced to ISO and
 * keys sorted so equivalent queries (differing only in param order) share a key.
 */
function filterHash(q: ListTasksQuery): string {
  const canonical: Record<string, unknown> = {};
  for (const key of Object.keys(q).sort()) {
    const value = (q as Record<string, unknown>)[key];
    if (value === undefined) continue;
    canonical[key] = value instanceof Date ? value.toISOString() : value;
  }
  return createHash("sha1").update(JSON.stringify(canonical)).digest("base64url");
}

export function taskListKey(scope: string, version: number, hash: string): string {
  return `tasks:list:${scope}:v${version}:${hash}`;
}

/** Cache-aside for `task.service.list`. */
export async function readThroughList<T>(
  user: AuthUser,
  q: ListTasksQuery,
  loader: () => Promise<T>,
): Promise<T> {
  const { scope, ns } = readScope(user);
  const version = await getVersion(ns);
  const key = taskListKey(scope, version, filterHash(q));
  return withCache(key, env.CACHE_TTL_SECONDS, loader, recordCacheOutcome(user.id, null));
}

/**
 * Invalidate every cached task read affected by a mutation: bump the global
 * namespace (so admin views invalidate too) plus the per-user namespace of each
 * affected user. A task appears in both its owner's and its assignee's per-user
 * cache, so pass both — and on reassignment, the previous assignee as well.
 * Null/undefined/duplicate ids are ignored. Best-effort — never throws, so it
 * can't fail the mutation that triggered it.
 */
export async function invalidateTasks(
  ...userIds: (string | null | undefined)[]
): Promise<void> {
  const unique = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  await Promise.allSettled([
    bumpVersion(GLOBAL_VERSION_NS),
    ...unique.map((id) => bumpVersion(userVersionNs(id))),
  ]);
}

/**
 * Invalidate every user's cached task reads. Needed when shared data embedded in
 * task payloads (a global category/tag's name/color) changes, since that affects
 * all users at once. Bumps the global namespace plus every per-user namespace.
 * Best-effort — never throws, so it can't fail the mutation that triggered it.
 */
export async function invalidateAllTasks(): Promise<void> {
  try {
    const users = await prisma.user.findMany({ select: { id: true } });
    await Promise.allSettled([
      bumpVersion(GLOBAL_VERSION_NS),
      ...users.map((u) => bumpVersion(userVersionNs(u.id))),
    ]);
  } catch {
    // Swallow — cache invalidation must not fail the triggering mutation.
  }
}
