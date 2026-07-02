# TaskFlow

A full-stack task-management application. Users register, manage personal tasks against a shared category/tag catalogue, assign tasks to other users, and view analytics reports. Built as a **pnpm monorepo** with a TypeScript Express API and a React SPA.

```
capstone/
├── server/   # Backend REST API — Node 22 / Express 5 / TypeScript / Prisma 7 / PostgreSQL
├── client/   # Frontend SPA   — React 19 / Vite / TanStack Query / Tailwind / Radix UI
└── docs/     # Design specs and implementation plans
```

---

## Prerequisites

- **Node.js 22+**
- **pnpm** (the package manager for this repo — not npm)
- **PostgreSQL** (running and reachable)
- **Redis** — *optional*; the API caches task reads when `REDIS_URL` is set, and runs identically without it (caching silently no-ops)

Each package (`server/`, `client/`) has its own `package.json`, `node_modules`, and lockfile. Install and run commands per package.

---

## Quick start

### 1. Backend (`server/`)

```bash
cd server
pnpm install

cp .env.example .env          # then edit — see "Environment" below
pnpm db:generate              # generate the Prisma client into generated/prisma/
pnpm db:migrate               # create/apply migrations against your database
pnpm db:seed                  # optional: demo user, categories, tags, tasks

pnpm dev                      # watch-mode dev server on http://localhost:4000
```

At minimum you must set `DATABASE_URL` and `JWT_SECRET` in `server/.env` (the config layer validates env with zod and exits on missing/invalid values).

Health checks: `GET /health` (liveness) and `GET /api/health` (readiness — verifies PostgreSQL).

### 2. Frontend (`client/`)

```bash
cd client
pnpm install
pnpm dev                      # Vite dev server (default http://localhost:5173)
```

The Vite dev server **proxies `/api` to `http://localhost:4000`**, so start the backend first. Keeping the browser same-origin preserves the httpOnly refresh-token cookie and the CORS-credentials flow. No frontend env file is required for local dev.

### Common commands

| | Backend (`cd server`) | Frontend (`cd client`) |
|---|---|---|
| Dev server | `pnpm dev` | `pnpm dev` |
| Build | `pnpm build` (→ `dist/`) | `pnpm build` (→ `dist/`) |
| Start (prod) | `pnpm start` | `pnpm preview` |
| Tests | `pnpm test` / `pnpm test:watch` | — |
| Lint | *(none configured)* | `pnpm lint` |
| DB migrate / generate / seed / studio | `pnpm db:migrate` · `pnpm db:generate` · `pnpm db:seed` · `pnpm db:studio` | — |

> You can also run these from the repo root with pnpm's `-C` flag, e.g. `pnpm -C server dev`.

---

## Environment (`server/.env`)

Parsed and validated in `server/src/config/env.ts`. Import `env` from there — never read `process.env` elsewhere.

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | **yes** | — | PostgreSQL connection string |
| `JWT_SECRET` | **yes** | — | Access-token signing secret (min 32 chars) |
| `NODE_ENV` | no | `development` | `development` \| `test` \| `production` |
| `PORT` | no | `4000` | API port |
| `CORS_ORIGIN` | no | `*` | Comma-separated allowed origins, or `*` |
| `JWT_ACCESS_TTL` | no | `15m` | Access-token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | no | `30` | Refresh-token lifetime (DB + cookie) |
| `BCRYPT_ROUNDS` | no | `12` | bcrypt cost factor (10–15) |
| `REFRESH_COOKIE_NAME` | no | `refresh_token` | Refresh cookie name |
| `LOG_LEVEL` | no | per-env | pino log level |
| `REDIS_URL` | no | — | Enables the task-read cache when set |
| `CACHE_ENABLED` | no | `true` | Master cache kill-switch (needs `REDIS_URL` too) |
| `CACHE_TTL_SECONDS` | no | `300` | Cache data-key TTL |

> Note: with Prisma 7 the datasource URL lives in `server/prisma.config.ts` (loaded from `.env`), **not** in `schema.prisma`; the runtime client connects through the node-postgres driver adapter.

---

## Architecture

### Backend — layered MVC

REST API under a versioned prefix (`/api/v1`). Each feature is split by role into `<feature>.<layer>.ts` files:

```
Request → middleware (logging → helmet → cors → json → cookies)
        → routes/      (wiring only; versioned mount)
        → middleware/  (authenticate, requireRole, validate)
        → controllers/ (thin: read validated input, call service, shape HTTP response)
        → services/    (business logic + all Prisma access; return DTOs)
        → notFound → errorHandler (stable { error: { message, code? } } contract)
```

- **Validation** — zod schemas in `validators/`; the `validate()` middleware parses `body`/`params`/`query` and exposes it via a typed `validated<T>(req)` helper.
- **Auth** — JWT access tokens + rotating refresh tokens (httpOnly cookie). Middleware attaches `req.user = { id, role }`.
- **RBAC** — two layers: **role gating** (`requireRole("ADMIN")`) and **ownership scoping** (`ownerScope`/`taskAccessScope`) spread into Prisma `where` clauses so USER sees their own rows and ADMIN sees all. Tasks are visible to both owner and assignee; reassigning/deleting stay owner/admin-only.
- **Errors** — throw `AppError` (or its static helpers); the central handler serializes to a stable JSON contract and auto-translates known Prisma errors. Error strings/codes live in `src/constants/errors.ts` — never hardcoded inline.
- **Optimistic concurrency** — `PATCH /tasks/:id` requires the last-read `version`; a mismatch returns `409 TASK_VERSION_CONFLICT`.
- **Reports** — backed by per-user PostgreSQL **materialized views** (queried via parameterized `$queryRaw`), refreshed on demand by an ADMIN endpoint.
- **Caching** — optional cache-aside over Redis (ioredis) in the service layer, using generation-counter invalidation; degrades silently when Redis is absent.

See **`server/CLAUDE.md`** for the full backend deep-dive (ESM/NodeNext import rules, Prisma 7 setup, cache invalidation, schema conventions, and the recipe for adding a feature).

### API surface (all under `/api/v1`)

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me` |
| Tasks | `GET /tasks` · `POST /tasks` · `GET /tasks/:id` · `PATCH /tasks/:id` · `DELETE /tasks/:id` |
| Catalogue | `GET /categories` · `GET /tags` *(shared, read-only)* |
| Users | `GET /users/assignable` *(any user)* · `GET /users` · `GET /users/:id` *(ADMIN)* |
| Reports | `GET /reports/summary` · `GET /reports/by-category` · `GET /reports/completion-trend` · `POST /reports/refresh` *(ADMIN)* |
| Metrics | `GET /metrics/cache` *(cache hit/miss ratio)* |
| Health | `GET /health` · `GET /api/health` *(unversioned)* |

### Frontend — React SPA

- **Vite + React 19** (with the React Compiler), **TypeScript**, **Tailwind CSS v4**, **Radix UI** primitives (shadcn-style components in `src/components/ui`).
- **TanStack Query** for server state / data fetching, **axios** for the HTTP client, **React Router** for routing, **react-hook-form + zod** for forms, **Recharts** for report charts, **sonner** for toasts.
- **Feature-based structure** under `src/features/` (`auth`, `tasks`, `reports`), page components in `src/pages/`, shared UI in `src/components/`.
- **Routing**: `/login` (public), and protected routes behind an auth guard + app layout — `/` (tasks) and `/reports`. Auth state is held in an `AuthProvider`/`useAuth` context.

---

## Testing

Backend tests are **vitest + supertest** integration tests in `server/tests/`. They mount the app in-process (no port bound) and hit the **real** database in `DATABASE_URL`, creating uniquely-named users and cleaning them up afterward — so **a PostgreSQL instance must be running**. Redis is not required (tests set no `REDIS_URL`, so caching no-ops).

```bash
cd server
pnpm test          # run once
pnpm test:watch    # watch mode
```

---

## License

MIT
