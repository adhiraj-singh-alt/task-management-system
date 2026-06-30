import { TaskPriority, TaskStatus } from "../../generated/prisma/client.js";
import type { Role } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";

/**
 * Reports read from precomputed materialized views (see the
 * add_report_materialized_views migration). USER queries are scoped to their own
 * user_id; ADMIN aggregates across all users. Data is as-of the last refresh
 * (POST /reports/refresh).
 */

type AuthUser = { id: string; role: Role };

const isAdmin = (user: AuthUser) => user.role === "ADMIN";

// --- Row shapes returned by the raw queries --------------------------------

interface SummaryRow {
  total: number;
  completed: number;
  open: number;
  archived: number;
  overdue: number;
}
interface StatusRow {
  status: TaskStatus;
  count: number;
}
interface PriorityRow {
  priority: TaskPriority;
  count: number;
}
interface CategoryRow {
  category_id: string | null;
  category_name: string | null;
  count: number;
}
interface TrendRow {
  day: string;
  count: number;
}

const EMPTY_SUMMARY: SummaryRow = {
  total: 0,
  completed: 0,
  open: 0,
  archived: 0,
  overdue: 0,
};

/** Build a {KEY: count} map across all enum values, zero-filling the gaps. */
function countMap<K extends string>(keys: K[], rows: { key: K; count: number }[]) {
  const map = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  for (const row of rows) map[row.key] = row.count;
  return map;
}

// --- Reports ---------------------------------------------------------------

export async function getSummary(user: AuthUser) {
  const summaryRows = isAdmin(user)
    ? await prisma.$queryRaw<SummaryRow[]>`
        SELECT
          COALESCE(SUM("total"), 0)::int     AS "total",
          COALESCE(SUM("completed"), 0)::int AS "completed",
          COALESCE(SUM("open"), 0)::int      AS "open",
          COALESCE(SUM("archived"), 0)::int  AS "archived",
          COALESCE(SUM("overdue"), 0)::int   AS "overdue"
        FROM "report_task_summary"`
    : await prisma.$queryRaw<SummaryRow[]>`
        SELECT "total", "completed", "open", "archived", "overdue"
        FROM "report_task_summary"
        WHERE "user_id" = ${user.id}::uuid`;

  const summary = summaryRows[0] ?? EMPTY_SUMMARY;

  const statusRows = isAdmin(user)
    ? await prisma.$queryRaw<StatusRow[]>`
        SELECT "status", SUM("count")::int AS "count"
        FROM "report_task_status" GROUP BY "status"`
    : await prisma.$queryRaw<StatusRow[]>`
        SELECT "status", "count" FROM "report_task_status"
        WHERE "user_id" = ${user.id}::uuid`;

  const priorityRows = isAdmin(user)
    ? await prisma.$queryRaw<PriorityRow[]>`
        SELECT "priority", SUM("count")::int AS "count"
        FROM "report_task_priority" GROUP BY "priority"`
    : await prisma.$queryRaw<PriorityRow[]>`
        SELECT "priority", "count" FROM "report_task_priority"
        WHERE "user_id" = ${user.id}::uuid`;

  return {
    summary: {
      ...summary,
      completionRate: summary.total ? summary.completed / summary.total : 0,
    },
    byStatus: countMap(
      Object.values(TaskStatus),
      statusRows.map((r) => ({ key: r.status, count: r.count })),
    ),
    byPriority: countMap(
      Object.values(TaskPriority),
      priorityRows.map((r) => ({ key: r.priority, count: r.count })),
    ),
  };
}

export async function getByCategory(user: AuthUser) {
  const rows = isAdmin(user)
    ? await prisma.$queryRaw<CategoryRow[]>`
        SELECT "category_id", "category_name", SUM("count")::int AS "count"
        FROM "report_task_category"
        GROUP BY "category_id", "category_name"
        ORDER BY "count" DESC`
    : await prisma.$queryRaw<CategoryRow[]>`
        SELECT "category_id", "category_name", "count"
        FROM "report_task_category"
        WHERE "user_id" = ${user.id}::uuid
        ORDER BY "count" DESC`;

  return {
    categories: rows.map((r) => ({
      categoryId: r.category_id,
      categoryName: r.category_name,
      count: r.count,
    })),
  };
}

export async function getCompletionTrend(user: AuthUser, days: number) {
  const rows = isAdmin(user)
    ? await prisma.$queryRaw<TrendRow[]>`
        SELECT to_char("day", 'YYYY-MM-DD') AS "day", SUM("count")::int AS "count"
        FROM "report_completion_daily"
        WHERE "day" >= (CURRENT_DATE - ${days}::int)
        GROUP BY "day" ORDER BY "day"`
    : await prisma.$queryRaw<TrendRow[]>`
        SELECT to_char("day", 'YYYY-MM-DD') AS "day", "count"
        FROM "report_completion_daily"
        WHERE "user_id" = ${user.id}::uuid AND "day" >= (CURRENT_DATE - ${days}::int)
        ORDER BY "day"`;

  return { days, points: rows };
}

const MATERIALIZED_VIEWS = [
  "report_task_summary",
  "report_task_status",
  "report_task_priority",
  "report_task_category",
  "report_completion_daily",
] as const;

/**
 * Refresh every report view. CONCURRENTLY avoids locking reads and cannot run
 * inside a transaction, so each view is refreshed in its own statement. View
 * names are a fixed allowlist (no user input) — safe for $executeRawUnsafe.
 */
export async function refreshViews(): Promise<readonly string[]> {
  for (const view of MATERIALIZED_VIEWS) {
    await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY "${view}"`);
  }
  return MATERIALIZED_VIEWS;
}
