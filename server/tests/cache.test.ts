import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { cacheGet, getVersion, withCache } from "../src/lib/cache.js";
import { disconnectRedis } from "../src/lib/redis.js";
import { AUTH_PATH, TASKS_PATH } from "../src/constants/routes.js";

/**
 * The unit block always runs: with no REDIS_URL configured (the vitest default)
 * caching is disabled, so every helper must be a safe no-op. The integration
 * block only runs when REDIS_URL is set, exercising real hit/miss + invalidation.
 */

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("cache helpers degrade to no-ops when disabled", () => {
  it("withCache always runs the loader (never caches) when disabled", async () => {
    let calls = 0;
    const load = async () => {
      calls += 1;
      return { hello: "world" };
    };

    expect(await withCache("test:key", 60, load)).toEqual({ hello: "world" });
    expect(await withCache("test:key", 60, load)).toEqual({ hello: "world" });
    expect(calls).toBe(2); // no hit on the second call
  });

  it("getVersion reports 0 when disabled", async () => {
    expect(await getVersion("v:tasks:all")).toBe(0);
  });

  it("cacheGet returns null when disabled", async () => {
    expect(await cacheGet("anything")).toBeNull();
  });
});

describe.skipIf(!process.env.REDIS_URL)(
  "task cache hit + mutation invalidation (requires REDIS_URL)",
  () => {
    const app = createApp();
    const runId = Date.now();
    const password = "password123";
    const prefix = `vitest_cache_${runId}`;
    const emailUser = `${prefix}_u@example.com`;
    const emailAdmin = `${prefix}_admin@example.com`;

    let tokenUser = "";
    let tokenAdmin = "";
    let taskId = "";

    beforeAll(async () => {
      await prisma.user.deleteMany({ where: { email: { contains: prefix } } });

      const reg = await request(app)
        .post(`${AUTH_PATH}/register`)
        .send({ email: emailUser, password, name: "U" });
      tokenUser = reg.body.accessToken;

      await request(app)
        .post(`${AUTH_PATH}/register`)
        .send({ email: emailAdmin, password, name: "A" });
      await prisma.user.update({ where: { email: emailAdmin }, data: { role: "ADMIN" } });
      const login = await request(app)
        .post(`${AUTH_PATH}/login`)
        .send({ email: emailAdmin, password });
      tokenAdmin = login.body.accessToken;

      const created = await request(app)
        .post(TASKS_PATH)
        .set(auth(tokenUser))
        .send({ title: "original" });
      taskId = created.body.task.id;
    });

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { email: { contains: prefix } } });
      await disconnectRedis();
      await prisma.$disconnect();
    });

    it("serves a stale cached read after a direct DB write (proves caching)", async () => {
      // Prime the cache.
      const first = await request(app).get(`${TASKS_PATH}/${taskId}`).set(auth(tokenUser));
      expect(first.body.task.title).toBe("original");

      // Mutate the row directly, bypassing the API — no invalidation fires.
      await prisma.task.update({ where: { id: taskId }, data: { title: "changed-in-db" } });

      // The cached value is still served.
      const second = await request(app).get(`${TASKS_PATH}/${taskId}`).set(auth(tokenUser));
      expect(second.body.task.title).toBe("original");
    });

    it("reflects the change after an API mutation invalidates the cache", async () => {
      const patch = await request(app)
        .patch(`${TASKS_PATH}/${taskId}`)
        .set(auth(tokenUser))
        .send({ title: "via-api" });
      expect(patch.status).toBe(200);

      const after = await request(app).get(`${TASKS_PATH}/${taskId}`).set(auth(tokenUser));
      expect(after.body.task.title).toBe("via-api");
    });

    it("invalidates the ADMIN global view when a USER mutates (cross-tenant)", async () => {
      // Admin reads under the global namespace.
      const adminFirst = await request(app).get(`${TASKS_PATH}/${taskId}`).set(auth(tokenAdmin));
      expect(adminFirst.body.task.title).toBe("via-api");

      // A normal user's edit must bump the global counter too.
      await request(app)
        .patch(`${TASKS_PATH}/${taskId}`)
        .set(auth(tokenUser))
        .send({ title: "user-edit" });

      const adminAfter = await request(app).get(`${TASKS_PATH}/${taskId}`).set(auth(tokenAdmin));
      expect(adminAfter.body.task.title).toBe("user-edit");
    });
  },
);
