# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

TaskFlow backend — a task-management REST API. **Implemented:** JWT auth with rotating refresh tokens, RBAC (USER/ADMIN + per-user ownership scoping), full CRUD for Tasks plus a **read-only** (list) API for the shared Categories/Tags catalogue, a small ADMIN-only Users read API, a Reports/analytics module backed by PostgreSQL materialized views, an optional Redis cache for task reads, and **optimistic concurrency on task updates** — all under `/api/v1`, with vitest+supertest integration tests. **Not yet built:** `audit_logs` wiring (the model exists but nothing writes to it), production scheduling of the report-view refresh, and the React frontend's reports UI. Rate limiting was added then removed (to re-apply deliberately later).

Stack: Node 22+ / Express 5 / TypeScript / Prisma 7 / PostgreSQL. Package manager is **pnpm** (not npm).

## Commands

```bash
pnpm dev            # watch-mode dev server (tsx), port 4000
pnpm build          # tsc -> dist/
pnpm start          # run compiled dist/server.js
pnpm db:migrate     # prisma migrate dev — create/apply a migration
pnpm db:generate    # regenerate the Prisma client into generated/prisma/
pnpm db:seed        # tsx prisma/seed.ts — demo user/categories/tags/tasks
pnpm db:studio      # Prisma Studio
pnpm test           # vitest run — integration tests (needs the DB up)
pnpm test:watch     # vitest in watch mode
```

**Tests** are vitest + supertest integration tests in `tests/`, mounting the app via `createApp()` (no port bound). They hit the **real** database in `DATABASE_URL`, creating uniquely-named users (`vitest_<ts>@…`) and cleaning them up in `afterAll` — so a Postgres instance must be running. `vitest.config.ts` forces `NODE_ENV=test`, which silences logging. There is **no linter** configured.

## Architecture notes (the non-obvious parts)

**ESM + NodeNext.** `package.json` is `"type": "module"` and tsconfig uses `NodeNext`. **All relative imports must carry a `.js` extension even though the source is `.ts`** (e.g. `import { env } from "./config/env.js"`). This includes importing the generated Prisma client from `../../generated/prisma/client.js`.

**Prisma 7 is configured differently from older versions:**
- The datasource URL is **not** in `schema.prisma`. It lives in `prisma.config.ts`, loaded from `.env` via `dotenv/config`.
- The runtime client connects through the **node-postgres driver adapter** (`@prisma/adapter-pg`), constructed in `src/lib/prisma.ts` — not by Prisma reading `DATABASE_URL` directly.
- The client is generated to `generated/prisma/` (gitignored), not `node_modules`. Run `pnpm db:generate` after schema changes; import types/client from there.
- `src/lib/prisma.ts` caches the `PrismaClient` on `globalThis` in non-production so `tsx watch` hot reloads don't leak connection pools.

**Config is validated and fail-fast.** `src/config/env.ts` parses `process.env` with zod and `process.exit(1)` on invalid/missing vars. Import `env` (and `isProduction`) from there — never reach for `process.env` elsewhere.

**Error handling is a stable API contract.** Throw `AppError` (or its static helpers `AppError.badRequest/unauthorized/forbidden/notFound/conflict`) from controller/service code. The central `errorHandler` (registered last, after `notFound`) serializes everything to `{ "error": { "message": string, "code"?: string } }`. Non-`AppError` throws become a generic 500 (real message hidden in production). Express 5 auto-forwards async-handler rejections, so handlers can `throw` directly without try/catch wrappers. **Don't hardcode error messages/codes** — add them to `src/constants/errors.ts` (`ERROR_MESSAGES`/`ERROR_CODES`) and reference those. Known Prisma errors are auto-translated to `AppError` by `src/utils/prismaError.ts` in the central handler (`P2002`→409, `P2025`→404, `P2003`→400), so you usually don't need to catch them in services.

**Optimistic concurrency on `Task.update`.** `Task` has an integer `version` column (`@default(0)`, distinct from `@updatedAt`). Every `PATCH /tasks/:id` **requires** a `version` in the body (the value the client last read); a mismatch means someone else wrote first and returns **409 `TASK_VERSION_CONFLICT`** — the client must re-fetch and reapply (no server-side auto-retry, which would clobber). Because Prisma's `update` `where` only accepts unique fields, the compare-and-set uses `updateMany({ where: { id, version }, data: { …, version: { increment: 1 } } })` inside an **interactive transaction** (`task.service.ts:update`) that also does the tag rewrite and re-reads with includes; `count === 0` after the up-front access check ⇒ 409. `version` is always incremented (even a tags-only edit conflicts correctly) and flows out of every task DTO via `serializeTask`. Only `update` is guarded — `create` returns `version: 0`, `remove` is unguarded. The generic `src/utils/retry.ts` backoff helper is unrelated/unused and intended for transient DB errors (e.g. `P2034`), not this 409.

**Layer-based MVC.** Each feature is split by role, named `<feature>.<layer>.ts`:
- `src/validators/` — zod schemas + inferred input types.
- `src/middleware/validate.ts` — `validate(schema, source?)` validates `body` (default), `params`, or `query` and stores the parsed result on `req.validated[source]` (it does **not** write back to `req.query`, which is read-only in Express 5). Controllers read it via the typed `validated<T>(req, source?)` helper in `src/utils/request.ts`.
- `src/controllers/` — thin `RequestHandler`s: read `validated<T>(req)` / `getAuthUser(req)`, call a service, shape the HTTP response (status, cookies). No Prisma, no zod.
- `src/services/` — business logic + all Prisma access; return plain data/DTOs (never expose `passwordHash` — use the `publicUserSelect` pattern).
- `src/routes/` — wiring only: feature routers use relative paths (e.g. `/login`) and are mounted under the versioned prefix in `src/routes/index.ts`. **URLs are versioned**: `API_PREFIX`/`AUTH_PATH` live in `src/constants/routes.ts` (currently `/api/v1`); the refresh cookie's `path` is derived from `AUTH_PATH`, so bump the prefix in one place. Health is intentionally unversioned.

**Cross-cutting middleware** (in `createApp`, order matters): `pino-http` (request logging, adds `req.log`/`req.id`) → helmet → cors(credentials) → json → cookieParser → routers → `notFound` → `errorHandler`. Use `req.log` for request-scoped logs, else the shared `logger` from `src/lib/logger.ts` (pino; pretty in dev, JSON in prod, silent in test). **Rate limiting is currently removed** (it was tripping the SPA's per-load `/auth/refresh` in dev) — `express-rate-limit` is still installed and `AppError.tooManyRequests` + the `TOO_MANY_REQUESTS` constants remain, to be re-applied deliberately later (likely a strict limiter on login/register only, generous or none on refresh).

**RBAC has two layers** (auth attaches `req.user = { id, role }`):
- **Role gating** — `requireRole(...roles)` from `src/middleware/authorize.ts`, placed after `authenticate` (e.g. the ADMIN-only `users` routes). Throws 403 `FORBIDDEN`.
- **Ownership scoping** — `ownerScope(user)` from `src/utils/ownership.ts` returns `{}` for ADMIN and `{ userId }` for USER. Spread it into an **owned** resource `where` clause so ADMIN has global access and USER is limited to their own rows. Single-record ops use `findFirst({ where: { id, ...ownerScope(user) } })` → 404 for non-owners (no existence leak), not 403. When a task references its **owned** parent (`parentId`), verify the parent belongs to the task's owner. **Categories and tags are not owned** — they're a shared global catalogue (see below), so task writes only verify a referenced `categoryId`/`tagIds` **exists**, not who owns it.
- **Task assignment scoping** — tasks are visible to **both their owner and their assignee** (`Task.assignedToId`). For task **reads and general updates**, use `taskAccessScope(user)` (same file) instead of `ownerScope`: `{}` for ADMIN, `{ OR: [{ userId }, { assignedToId }] }` for USER. Combine it via `AND: [taskAccessScope(user)]` so it doesn't collide with the list `search` `OR`. **Reassigning** (writing `assignedToId`) and **deleting** stay owner/admin-only — `update` throws 403 `FORBIDDEN` if a non-owner sends `assignedToId`, and `remove` keeps the stricter `ownerScope`. A referenced `assignedToId` is verified to exist (404 `ASSIGNEE_NOT_FOUND`). The assignee picker is `GET /api/v1/users/assignable` (any authenticated user; narrow `assignableUserSelect` of id/name/email), mounted **before** the `requireRole("ADMIN")` gate in `user.routes.ts`.

**Categories and tags are a shared, global catalogue, exposed read-only.** Unlike tasks, `Category`/`Tag` have **no `userId`** — every user sees the same rows, and `name` is globally `@unique`. The API exposes **only `GET /` (list)** on `category.routes.ts`/`tag.routes.ts` — the single endpoint the frontend consumes; there are **no write endpoints** (get-by-id/create/update/delete were removed). Catalogue rows are managed out-of-band via `db:seed`/Prisma/DB. The services are list-only and take no `AuthUser`. Task writes still verify a referenced `categoryId`/`tagIds` **exists** (404 via `CATEGORY_NOT_FOUND`/`TAG_NOT_FOUND` in `task.service.ts`), and those error constants remain for that reason. `invalidateAllTasks()` in `taskCache.ts` is retained for future catalogue mutations but is currently unused (no API path mutates the catalogue).

**Adding a feature:** create `<f>.validator.ts` → `<f>.service.ts` → `<f>.controller.ts` → `<f>.routes.ts` (services take the `AuthUser` and apply `ownerScope`), add a `<F>_PATH` to `src/constants/routes.ts`, then mount the router in `src/routes/index.ts` (which `app.ts` mounts before `notFound`/`errorHandler`). Existing modules to copy from: `task` (owned resource, full CRUD), `category`/`tag` (shared global catalogue, read-only list), `user` (ADMIN-only reads). Shared bits: `idParamSchema`/`paginationSchema` (`src/validators/common.validator.ts`), `publicUserSelect`/`PublicUser` (`src/utils/userSelect.ts`).

**Reports use materialized views (not Prisma models).** The `reports` module reads from 5 per-user MVs (`report_task_summary`/`_status`/`_priority`/`_category`/`_completion_daily`) created in a **manual SQL migration** (`prisma migrate dev --create-only`, then hand-written `CREATE MATERIALIZED VIEW` + a UNIQUE index per view so they can `REFRESH … CONCURRENTLY`). Prisma doesn't model MVs, so `report.service.ts` queries them with **parameterized `prisma.$queryRaw`** (counts cast `::int` to avoid JS BigInt). RBAC: USER filters `WHERE user_id = ${id}::uuid`; ADMIN aggregates with `SUM(...) GROUP BY`. Views are stale until refreshed via `POST /api/v1/reports/refresh` (ADMIN-only; `$executeRawUnsafe` over a fixed view allowlist); `overdue` is therefore an as-of-refresh snapshot. To change a view, write a new migration (Prisma won't drop/alter MVs itself).

**Caching is optional and lives in the service layer.** Task reads (`task.service.list`/`getById`) are cache-aside via `src/lib/cache.ts` (`withCache`) over an ioredis client in `src/lib/redis.ts`. **It degrades silently:** if `REDIS_URL` is unset or Redis is down, every cache op no-ops and reads fall back to Postgres — so tests (which set no `REDIS_URL`) and Redis-less dev are unaffected. Gate is `cacheEnabled` in `src/config/env.ts` (`CACHE_ENABLED && !!REDIS_URL`). **Invalidation is generation-counter based, not SCAN:** two version namespaces — `v:tasks:u:{userId}` (USER scope) and `v:tasks:all` (ADMIN sees all rows) — are embedded in data keys; bumping a counter orphans old keys (they expire by `CACHE_TTL_SECONDS`). Counters **must never be given a TTL**. Every task mutation calls `invalidateTasks(...userIds)` in `src/services/taskCache.ts` (variadic; dedupes, ignores null), which INCRs the global namespace plus each affected user's namespace. Because a task lives in **both** its owner's and its assignee's per-user cache, pass both — and on **reassignment**, the previous assignee too (`invalidateTasks(ownerId, prevAssigneeId, newAssigneeId)`). `invalidateAllTasks()` (same file) bumps the global namespace **and** every per-user namespace — intended for shared catalogue mutations (a category/tag rename can affect any user's cached payloads). It's currently unused since the catalogue has no write endpoints, but kept for when such mutations return. When adding a mutation that touches data embedded in a cached task, call the appropriate invalidator after the write commits. Cache the **serialized DTO** (post-`serializeTask`), never the raw join-row shape.

## Schema conventions

In `prisma/schema.prisma`, model fields are camelCase while physical tables/columns are snake_case via `@@map`/`@map`. Most models follow this, but the `audit_logs` model is named in snake_case (inconsistent with `User`/`Task`/etc.) — match the surrounding model you're editing rather than copying `audit_logs`.

Tasks are single-user/personal: they hang off `User` with `onDelete: Cascade`. **Categories and tags are the exception** — they're a shared global catalogue with no `userId` and no cascade (see RBAC above), so deleting a user never removes catalogue rows. `Task.metadata` is a GIN-indexed JSONB column for arbitrary structured data without migrations.
