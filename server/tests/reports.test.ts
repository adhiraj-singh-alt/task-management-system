import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { refreshViews } from "../src/services/report.service.js";
import { AUTH_PATH, REPORTS_PATH, TASKS_PATH } from "../src/constants/routes.js";

/**
 * Integration tests for the reports module (materialized views). A fresh USER's
 * data is deterministic when scoped to their own user_id, so we assert exact
 * numbers there; ADMIN reports are global, so we only sanity-check lower bounds.
 */

const app = createApp();
const runId = Date.now();
const password = "password123";
const emailPrefix = `vitest_reports_${runId}`;
const email = `${emailPrefix}_user@example.com`;

let token = "";
let categoryId = "";
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: emailPrefix } } });

  token = (
    await request(app).post(`${AUTH_PATH}/register`).send({ email, password, name: "Rep" })
  ).body.accessToken;

  // A category for the by-category report. Categories are a shared, global
  // catalogue created by ADMINs; seed it directly with a run-unique name.
  const cat = await prisma.category.create({ data: { name: `Work-${runId}`, color: "#3b82f6" } });
  categoryId = cat.id;

  // 5 tasks: 2 TODO (one overdue + categorized), 1 IN_PROGRESS, 2 DONE.
  const tasks = [
    { title: "A overdue", status: "TODO", priority: "HIGH", dueDate: "2020-01-01", categoryId },
    { title: "B", status: "TODO", priority: "LOW" },
    { title: "C", status: "IN_PROGRESS", priority: "MEDIUM" },
    { title: "D done", status: "DONE", priority: "HIGH" },
    { title: "E done", status: "DONE", priority: "URGENT" },
  ];
  for (const t of tasks) {
    await request(app).post(TASKS_PATH).set(auth(token)).send(t);
  }

  // Materialized views are stale until refreshed.
  await refreshViews();
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: emailPrefix } } });
  // Categories are global (no cascade from user deletion), so clean it up too.
  await prisma.category.deleteMany({ where: { id: categoryId } });
  await prisma.$disconnect();
});

describe("reports", () => {
  it("summary reflects the user's tasks (scoped, exact)", async () => {
    const res = await request(app).get(`${REPORTS_PATH}/summary`).set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({
      total: 5,
      completed: 2,
      open: 3,
      archived: 0,
      overdue: 1,
    });
    expect(res.body.summary.completionRate).toBeCloseTo(0.4, 5);
    expect(res.body.byStatus).toMatchObject({
      TODO: 2,
      IN_PROGRESS: 1,
      DONE: 2,
      ARCHIVED: 0,
    });
    expect(res.body.byPriority).toMatchObject({
      LOW: 1,
      MEDIUM: 1,
      HIGH: 2,
      URGENT: 1,
    });
  });

  it("by-category splits categorized vs uncategorized", async () => {
    const res = await request(app).get(`${REPORTS_PATH}/by-category`).set(auth(token));

    expect(res.status).toBe(200);
    const work = res.body.categories.find(
      (c: { categoryName: string | null }) => c.categoryName === `Work-${runId}`,
    );
    const uncategorized = res.body.categories.find(
      (c: { categoryId: string | null }) => c.categoryId === null,
    );
    expect(work?.count).toBe(1);
    expect(uncategorized?.count).toBe(4);
  });

  it("completion-trend counts the two completed tasks", async () => {
    const res = await request(app)
      .get(`${REPORTS_PATH}/completion-trend?days=30`)
      .set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.days).toBe(30);
    const totalCompleted = res.body.points.reduce(
      (sum: number, p: { count: number }) => sum + p.count,
      0,
    );
    expect(totalCompleted).toBe(2);
  });

  it("rejects an invalid days param (400)", async () => {
    const res = await request(app)
      .get(`${REPORTS_PATH}/completion-trend?days=0`)
      .set(auth(token));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("forbids a USER from refreshing the views (403)", async () => {
    const res = await request(app).post(`${REPORTS_PATH}/refresh`).set(auth(token));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("lets an ADMIN refresh, and ADMIN summary is global (>= the user's)", async () => {
    await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
    const adminToken = (
      await request(app).post(`${AUTH_PATH}/login`).send({ email, password })
    ).body.accessToken;

    const refresh = await request(app)
      .post(`${REPORTS_PATH}/refresh`)
      .set(auth(adminToken));
    expect(refresh.status).toBe(200);
    expect(refresh.body.refreshed).toHaveLength(5);

    const summary = await request(app)
      .get(`${REPORTS_PATH}/summary`)
      .set(auth(adminToken));
    expect(summary.status).toBe(200);
    expect(summary.body.summary.total).toBeGreaterThanOrEqual(5);
  });
});
