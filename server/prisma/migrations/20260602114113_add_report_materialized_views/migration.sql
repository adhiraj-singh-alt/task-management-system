-- Reports/analytics: per-user aggregations precomputed as materialized views.
-- Each view is grouped by user_id so USER queries filter by it and ADMIN
-- aggregates across all rows. Each view has a UNIQUE index so it can be
-- refreshed with REFRESH MATERIALIZED VIEW CONCURRENTLY. Counts are ::int to
-- avoid JS BigInt serialization. `overdue` is evaluated at refresh time.

-- 1. Per-user summary (totals + overdue snapshot)
CREATE MATERIALIZED VIEW "report_task_summary" AS
SELECT
    "user_id",
    COUNT(*)::int AS "total",
    COUNT(*) FILTER (WHERE "status" = 'DONE')::int AS "completed",
    COUNT(*) FILTER (WHERE "status" IN ('TODO', 'IN_PROGRESS'))::int AS "open",
    COUNT(*) FILTER (WHERE "status" = 'ARCHIVED')::int AS "archived",
    COUNT(*) FILTER (
        WHERE "status" IN ('TODO', 'IN_PROGRESS')
          AND "due_date" IS NOT NULL
          AND "due_date" < now()
    )::int AS "overdue"
FROM "tasks"
GROUP BY "user_id";

CREATE UNIQUE INDEX "report_task_summary_user_id_key"
    ON "report_task_summary" ("user_id");

-- 2. Per-user counts by status
CREATE MATERIALIZED VIEW "report_task_status" AS
SELECT "user_id", "status", COUNT(*)::int AS "count"
FROM "tasks"
GROUP BY "user_id", "status";

CREATE UNIQUE INDEX "report_task_status_user_id_status_key"
    ON "report_task_status" ("user_id", "status");

-- 3. Per-user counts by priority
CREATE MATERIALIZED VIEW "report_task_priority" AS
SELECT "user_id", "priority", COUNT(*)::int AS "count"
FROM "tasks"
GROUP BY "user_id", "priority";

CREATE UNIQUE INDEX "report_task_priority_user_id_priority_key"
    ON "report_task_priority" ("user_id", "priority");

-- 4. Per-user counts by category (uncategorized -> NULL)
CREATE MATERIALIZED VIEW "report_task_category" AS
SELECT
    t."user_id",
    t."category_id",
    c."name" AS "category_name",
    COUNT(*)::int AS "count"
FROM "tasks" t
LEFT JOIN "categories" c ON c."id" = t."category_id"
GROUP BY t."user_id", t."category_id", c."name";

CREATE UNIQUE INDEX "report_task_category_user_id_category_id_key"
    ON "report_task_category" ("user_id", "category_id") NULLS NOT DISTINCT;

-- 5. Per-user daily completion counts (for trend charts)
CREATE MATERIALIZED VIEW "report_completion_daily" AS
SELECT
    "user_id",
    (date_trunc('day', "completed_at"))::date AS "day",
    COUNT(*)::int AS "count"
FROM "tasks"
WHERE "completed_at" IS NOT NULL
GROUP BY "user_id", (date_trunc('day', "completed_at"))::date;

CREATE UNIQUE INDEX "report_completion_daily_user_id_day_key"
    ON "report_completion_daily" ("user_id", "day");
