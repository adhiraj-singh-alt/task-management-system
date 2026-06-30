import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { AUTH_PATH, TASKS_PATH, USERS_PATH } from "../src/constants/routes.js";

/**
 * Integration tests for RBAC + Tasks CRUD (with shared category/tag links).
 * Hits the real DB, creating uniquely-named users and cleaning them up after.
 * Categories & tags are a read-only catalogue, so they're seeded directly via
 * Prisma rather than created over the (now removed) write endpoints. `pnpm test`.
 */

const app = createApp();
const runId = Date.now();
const password = "password123";
const emailPrefix = `vitest_tasks_${runId}`;
const emailA = `${emailPrefix}_a@example.com`;
const emailB = `${emailPrefix}_b@example.com`;
const emailC = `${emailPrefix}_c@example.com`;
const emailAdmin = `${emailPrefix}_admin@example.com`;

// Categories & tags are a shared, global catalogue. Names must be unique across
// the whole DB (incl. seed data), so suffix them with the run id.
const catName = `Work-${runId}`;
const tagName = `urgent-${runId}`;

let tokenA = "";
let tokenB = "";
let tokenC = "";
let tokenAdmin = "";
let userBId = "";
let categoryId = "";
let tagId = "";

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function registerUser(email: string): Promise<string> {
  const res = await request(app)
    .post(`${AUTH_PATH}/register`)
    .send({ email, password, name: "Test" });
  expect(res.status).toBe(201);
  return res.body.accessToken;
}

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: emailPrefix } } });

  tokenA = await registerUser(emailA);
  tokenB = await registerUser(emailB);
  tokenC = await registerUser(emailC);
  userBId = (await prisma.user.findUniqueOrThrow({ where: { email: emailB } })).id;

  // Register, promote to ADMIN, then re-login so the access token carries ADMIN.
  await registerUser(emailAdmin);
  await prisma.user.update({ where: { email: emailAdmin }, data: { role: "ADMIN" } });
  const login = await request(app).post(`${AUTH_PATH}/login`).send({ email: emailAdmin, password });
  tokenAdmin = login.body.accessToken;

  // Categories & tags are a read-only catalogue with no write endpoints; seed
  // the run-scoped rows these tests reference directly via Prisma.
  categoryId = (await prisma.category.create({ data: { name: catName, color: "#3b82f6" } })).id;
  tagId = (await prisma.tag.create({ data: { name: tagName } })).id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: emailPrefix } } });
  // Categories & tags are global (no cascade from user deletion), so remove the
  // run-scoped ones this suite created.
  await prisma.category.deleteMany({ where: { name: { contains: String(runId) } } });
  await prisma.tag.deleteMany({ where: { name: { contains: String(runId) } } });
  await prisma.$disconnect();
});

describe("tasks + categories + tags + RBAC", () => {
  let taskId = "";

  it("creates a task linking the category + tag (201)", async () => {
    const res = await request(app)
      .post(TASKS_PATH)
      .set(auth(tokenA))
      .send({
        title: "Write report",
        priority: "HIGH",
        categoryId,
        tagIds: [tagId],
        dueDate: "2026-07-01T12:00:00.000Z",
      });

    expect(res.status).toBe(201);
    expect(res.body.task.title).toBe("Write report");
    expect(res.body.task.category.id).toBe(categoryId);
    expect(res.body.task.tags).toEqual([{ id: tagId, name: tagName }]);
    taskId = res.body.task.id;
  });

  it("rejects a task with an invalid body (400)", async () => {
    const res = await request(app).post(TASKS_PATH).set(auth(tokenA)).send({ title: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("lets another user reference the shared category (201)", async () => {
    const res = await request(app)
      .post(TASKS_PATH)
      .set(auth(tokenB)) // categories are global — any user may reference them
      .send({ title: "Shared cat ok", categoryId });

    expect(res.status).toBe(201);
    expect(res.body.task.category.id).toBe(categoryId);
  });

  it("rejects a task referencing a non-existent category (404)", async () => {
    const res = await request(app)
      .post(TASKS_PATH)
      .set(auth(tokenA))
      .send({ title: "Bad cat", categoryId: "11111111-1111-4111-8111-111111111111" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CATEGORY_NOT_FOUND");
  });

  it("lists the owner's tasks with filters + pagination (200)", async () => {
    const res = await request(app)
      .get(`${TASKS_PATH}?status=TODO&priority=HIGH&page=1&limit=10&sortBy=dueDate&order=asc`)
      .set(auth(tokenA));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, limit: 10 });
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(res.body.items.some((t: { id: string }) => t.id === taskId)).toBe(true);
  });

  it("gets a task by id (200)", async () => {
    const res = await request(app).get(`${TASKS_PATH}/${taskId}`).set(auth(tokenA));
    expect(res.status).toBe(200);
    expect(res.body.task.id).toBe(taskId);
  });

  it("updates a task to DONE and stamps completedAt (200)", async () => {
    const res = await request(app)
      .patch(`${TASKS_PATH}/${taskId}`)
      .set(auth(tokenA))
      .send({ status: "DONE" });

    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe("DONE");
    expect(res.body.task.completedAt).toBeTruthy();
  });

  // --- Ownership isolation ---

  it("hides another user's task (404 for non-owner)", async () => {
    const res = await request(app).get(`${TASKS_PATH}/${taskId}`).set(auth(tokenB));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TASK_NOT_FOUND");
  });

  it("scopes list to the requesting user", async () => {
    const res = await request(app).get(TASKS_PATH).set(auth(tokenB));
    expect(res.status).toBe(200);
    expect(res.body.items.some((t: { id: string }) => t.id === taskId)).toBe(false);
  });

  // --- RBAC ---

  it("forbids a USER from the admin users endpoint (403)", async () => {
    const res = await request(app).get(USERS_PATH).set(auth(tokenA));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("allows an ADMIN to list users (200)", async () => {
    const res = await request(app).get(USERS_PATH).set(auth(tokenAdmin));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.users.some((u: { email: string }) => u.email === emailA)).toBe(true);
  });

  it("lets an ADMIN read another user's task (global access)", async () => {
    const res = await request(app).get(`${TASKS_PATH}/${taskId}`).set(auth(tokenAdmin));
    expect(res.status).toBe(200);
    expect(res.body.task.id).toBe(taskId);
  });

  // --- Delete ---

  it("deletes a task (204), then 404 on re-fetch", async () => {
    const del = await request(app).delete(`${TASKS_PATH}/${taskId}`).set(auth(tokenA));
    expect(del.status).toBe(204);

    const refetch = await request(app).get(`${TASKS_PATH}/${taskId}`).set(auth(tokenA));
    expect(refetch.status).toBe(404);
  });
});

describe("task assignment", () => {
  // A owns these tasks; B is the assignee; C is an unrelated user.
  let assignedTaskId = "";

  it("lists assignable users for any authenticated USER (200)", async () => {
    const res = await request(app).get(`${USERS_PATH}/assignable`).set(auth(tokenA));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
    const me = res.body.users.find((u: { email: string }) => u.email === emailB);
    expect(me).toMatchObject({ id: userBId, email: emailB });
    // Narrow projection — no role/passwordHash leaked.
    expect(me).not.toHaveProperty("role");
    expect(me).not.toHaveProperty("passwordHash");
  });

  it("lets the owner assign a task to another user (201)", async () => {
    const res = await request(app)
      .post(TASKS_PATH)
      .set(auth(tokenA))
      .send({ title: "Assign to B", assignedToId: userBId });
    expect(res.status).toBe(201);
    expect(res.body.task.assignedToId).toBe(userBId);
    expect(res.body.task.assignedTo).toMatchObject({ id: userBId, email: emailB });
    assignedTaskId = res.body.task.id;
  });

  it("rejects assigning to a non-existent user (404)", async () => {
    const res = await request(app)
      .post(TASKS_PATH)
      .set(auth(tokenA))
      .send({ title: "Bad assignee", assignedToId: "11111111-1111-4111-8111-111111111111" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("ASSIGNEE_NOT_FOUND");
  });

  it("shows the assigned task to the assignee in list + get (200)", async () => {
    const list = await request(app)
      .get(`${TASKS_PATH}?assignedToId=${userBId}`)
      .set(auth(tokenB));
    expect(list.status).toBe(200);
    expect(list.body.items.some((t: { id: string }) => t.id === assignedTaskId)).toBe(true);

    const get = await request(app).get(`${TASKS_PATH}/${assignedTaskId}`).set(auth(tokenB));
    expect(get.status).toBe(200);
    expect(get.body.task.id).toBe(assignedTaskId);
  });

  it("lets the assignee update the task's status (200)", async () => {
    const res = await request(app)
      .patch(`${TASKS_PATH}/${assignedTaskId}`)
      .set(auth(tokenB))
      .send({ status: "DONE" });
    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe("DONE");
  });

  it("forbids the assignee from reassigning the task (403)", async () => {
    const res = await request(app)
      .patch(`${TASKS_PATH}/${assignedTaskId}`)
      .set(auth(tokenB))
      .send({ assignedToId: userBId });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("forbids the assignee from deleting the task (404, owner-only)", async () => {
    const res = await request(app).delete(`${TASKS_PATH}/${assignedTaskId}`).set(auth(tokenB));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TASK_NOT_FOUND");
  });

  it("hides the task from an unrelated user (404)", async () => {
    const res = await request(app).get(`${TASKS_PATH}/${assignedTaskId}`).set(auth(tokenC));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TASK_NOT_FOUND");
  });

  it("lets the owner clear the assignee with null (200)", async () => {
    const res = await request(app)
      .patch(`${TASKS_PATH}/${assignedTaskId}`)
      .set(auth(tokenA))
      .send({ assignedToId: null });
    expect(res.status).toBe(200);
    expect(res.body.task.assignedToId).toBeNull();
    expect(res.body.task.assignedTo).toBeNull();

    // Now B no longer sees it.
    const get = await request(app).get(`${TASKS_PATH}/${assignedTaskId}`).set(auth(tokenB));
    expect(get.status).toBe(404);
  });

  it("forbids assignable list without auth (401)", async () => {
    const res = await request(app).get(`${USERS_PATH}/assignable`);
    expect(res.status).toBe(401);
  });
});

describe("subtasks", () => {
  let parentId = "";
  let childId = "";

  const createTask = (token: string, body: Record<string, unknown>) =>
    request(app).post(TASKS_PATH).set(auth(token)).send(body);

  it("creates a parent task (201)", async () => {
    const res = await createTask(tokenA, { title: "Parent" });
    expect(res.status).toBe(201);
    parentId = res.body.task.id;
  });

  it("creates a subtask under the parent (201)", async () => {
    const res = await createTask(tokenA, { title: "Child", parentId });
    expect(res.status).toBe(201);
    expect(res.body.task.parentId).toBe(parentId);
    childId = res.body.task.id;
  });

  it("exposes nested subtasks + a progress rollup on the parent (200)", async () => {
    const res = await request(app).get(`${TASKS_PATH}/${parentId}`).set(auth(tokenA));
    expect(res.status).toBe(200);
    expect(res.body.task.subtaskCount).toBe(1);
    expect(res.body.task.completedSubtaskCount).toBe(0);
    expect(res.body.task.subtasks).toHaveLength(1);
    expect(res.body.task.subtasks[0].id).toBe(childId);
  });

  it("increments completedSubtaskCount when a subtask is marked DONE (200)", async () => {
    const done = await request(app)
      .patch(`${TASKS_PATH}/${childId}`)
      .set(auth(tokenA))
      .send({ status: "DONE" });
    expect(done.status).toBe(200);

    const res = await request(app).get(`${TASKS_PATH}/${parentId}`).set(auth(tokenA));
    expect(res.body.task.completedSubtaskCount).toBe(1);
  });

  it("lists top-level tasks only with parentId=null (subtask excluded)", async () => {
    const res = await request(app).get(`${TASKS_PATH}?parentId=null`).set(auth(tokenA));
    expect(res.status).toBe(200);
    const ids = res.body.items.map((t: { id: string }) => t.id);
    expect(ids).toContain(parentId);
    expect(ids).not.toContain(childId);
  });

  it("rejects nesting under an existing subtask — one level only (400)", async () => {
    const res = await createTask(tokenA, { title: "Grandchild", parentId: childId });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("SUBTASK_NESTING_NOT_ALLOWED");
  });

  it("rejects giving a parent-with-children its own parent (400)", async () => {
    const other = await createTask(tokenA, { title: "Other top-level" });
    const res = await request(app)
      .patch(`${TASKS_PATH}/${parentId}`)
      .set(auth(tokenA))
      .send({ parentId: other.body.task.id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("SUBTASK_NESTING_NOT_ALLOWED");
  });

  it("rejects a subtask under another user's parent (404)", async () => {
    const res = await createTask(tokenB, { title: "Sneaky child", parentId });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("PARENT_TASK_NOT_FOUND");
  });

  it("clears a subtask's parent with parentId=null, promoting it to top-level (200)", async () => {
    const p = await createTask(tokenA, { title: "Promo parent" });
    const c = await createTask(tokenA, {
      title: "Promo child",
      parentId: p.body.task.id,
    });
    expect(c.body.task.parentId).toBe(p.body.task.id);

    const res = await request(app)
      .patch(`${TASKS_PATH}/${c.body.task.id}`)
      .set(auth(tokenA))
      .send({ parentId: null });
    expect(res.status).toBe(200);
    expect(res.body.task.parentId).toBeNull();
  });

  it("cascade-deletes subtasks when the parent is removed (204 then 404)", async () => {
    const del = await request(app).delete(`${TASKS_PATH}/${parentId}`).set(auth(tokenA));
    expect(del.status).toBe(204);

    const refetch = await request(app).get(`${TASKS_PATH}/${childId}`).set(auth(tokenA));
    expect(refetch.status).toBe(404);
  });
});
