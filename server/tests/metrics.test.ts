import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { METRICS_PATH } from "../src/constants/routes.js";

/**
 * Integration tests for the metrics endpoint. It is public (no auth), so we hit
 * it with no token and assert the response shape. Tests run without REDIS_URL,
 * so counts may be zero — the ratio aggregation is exercised regardless.
 */

const app = createApp();

afterAll(async () => {
  await prisma.$disconnect();
});

describe("metrics", () => {
  it("returns cache metrics publicly (no auth) with a well-formed ratio", async () => {
    const res = await request(app).get(`${METRICS_PATH}/cache`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      hits: expect.any(Number),
      misses: expect.any(Number),
      total: expect.any(Number),
      hitRatio: expect.any(Number),
      missRatio: expect.any(Number),
    });
    expect(res.body.total).toBe(res.body.hits + res.body.misses);
    expect(res.body.hitRatio).toBeGreaterThanOrEqual(0);
    expect(res.body.hitRatio).toBeLessThanOrEqual(1);
  });
});
