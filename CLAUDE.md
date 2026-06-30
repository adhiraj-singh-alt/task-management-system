# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

TaskFlow — a task-management app, organized as a **monorepo**:

- **`server/`** — the backend REST API (Node 22 / Express 5 / TypeScript / Prisma 7 / PostgreSQL). This is the bulk of the project today. See **`server/CLAUDE.md`** for all backend architecture, conventions, and commands.
- **`client/`** — the React frontend. **Not created yet** — this is the next thing to build.

## Working in this repo

- **Backend** lives entirely under `server/`. Run its commands from there, e.g. `pnpm -C server dev`, `pnpm -C server test`, `pnpm -C server exec tsc --noEmit` (or `cd server` first). The package manager is **pnpm**. Each package keeps its own `package.json`, `node_modules`, and `.gitignore` under its folder.
- **Frontend** will live under `client/` once scaffolded.
- `.claude/` (project settings) stays at the repo root and applies across both packages.

When working on the backend, read `server/CLAUDE.md` first — it documents the layered MVC structure, auth/RBAC, validation, logging, error contract, and the per-feature file pattern.
