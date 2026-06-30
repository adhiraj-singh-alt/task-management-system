# TaskFlow — Backend

Production-ready task management API. **Milestone 1: project scaffold + database schema.**

Stack: **Node.js + Express 5 + TypeScript + Prisma 7 + PostgreSQL** (Redis, auth, REST
resources, analytics, tests and a React frontend arrive in later milestones).

## Prerequisites

- Node.js 22+
- pnpm 10+
- PostgreSQL 16+ running locally

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
#   then edit DATABASE_URL in .env to point at your database

# 3. Create the database (if it doesn't exist)
createdb taskflow

# 4. Apply the schema and generate the Prisma client
pnpm db:migrate

# 5. (optional) Load demo data
pnpm db:seed
```

> **Note:** Prisma 7 keeps the datasource URL in [`prisma.config.ts`](prisma.config.ts)
> (loaded from `.env` via dotenv) rather than in `schema.prisma`, and the runtime client
> connects through the **node-postgres driver adapter** (`@prisma/adapter-pg`) — see
> [`src/lib/prisma.ts`](src/lib/prisma.ts).

## Running

```bash
pnpm dev      # start in watch mode (tsx)
pnpm build    # compile TypeScript to dist/
pnpm start    # run the compiled server
```

Health checks:

```bash
curl http://localhost:4000/health      # liveness  -> { "status": "ok", ... }
curl http://localhost:4000/api/health  # readiness -> pings PostgreSQL
```

## Scripts

| Script            | Description                                  |
| ----------------- | -------------------------------------------- |
| `pnpm dev`        | Dev server with hot reload                   |
| `pnpm build`      | Type-check + compile to `dist/`              |
| `pnpm start`      | Run compiled server                          |
| `pnpm db:migrate` | Create/apply a migration (`prisma migrate dev`) |
| `pnpm db:generate`| Regenerate the Prisma client                 |
| `pnpm db:seed`    | Seed demo data                               |
| `pnpm db:studio`  | Open Prisma Studio                           |

## Project layout

```
prisma/
  schema.prisma        # data model: User, RefreshToken, Category, Tag, Task, TaskTag
  seed.ts              # demo user + categories + tags + tasks
  migrations/          # SQL migration history
src/
  config/env.ts        # zod-validated environment
  lib/prisma.ts        # PrismaClient singleton (pg driver adapter)
  utils/AppError.ts    # operational error type
  middleware/          # errorHandler, notFound
  routes/health.ts     # liveness + readiness
  app.ts               # builds the Express app (helmet, cors, json, routes)
  server.ts            # startup + graceful shutdown
generated/prisma/      # generated Prisma client (gitignored)
```

## Data model (summary)

- **User** — owns everything; `role` (`USER` / `ADMIN`) reserved for RBAC.
- **RefreshToken** — hashed, rotatable, revocable (for JWT refresh-token auth, later).
- **Category** — one per task; unique name per user.
- **Tag** — many per task via the explicit **TaskTag** join.
- **Task** — status/priority enums, due/completed dates, and a **JSONB `metadata`**
  column (GIN-indexed) for flexible structured data.

Single-user / personal model: each user sees only their own data.

## API surface (current)

| Method | Path          | Description                |
| ------ | ------------- | ------------------------- |
| GET    | `/health`     | Process liveness          |
| GET    | `/api/health` | Readiness (DB connectivity) |

Errors use a consistent shape: `{ "error": { "message": string, "code"?: string } }`.
