import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const healthRouter = Router();

/** Liveness — is the process up? No external dependencies touched. */
healthRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

/** Readiness — can we actually reach PostgreSQL? Async error -> errorHandler. */
healthRouter.get("/api/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok", database: "up" });
});
