import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Response } from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { env } from "../src/config/env.js";
import { AUTH_PATH } from "../src/constants/routes.js";

/**
 * Integration tests for the auth flow. These hit a real Postgres database (the
 * one in DATABASE_URL), creating a uniquely-named user and cleaning it up after.
 * Run with `pnpm test` (requires the DB to be up).
 */

const app = createApp();
const cookieName = env.REFRESH_COOKIE_NAME;

// Unique per run so repeated runs don't collide and we can clean up precisely.
const email = `vitest_${Date.now()}@example.com`;
const password = "password123";
const name = "Vitest User";

/** Pull the refresh-token value out of a Set-Cookie response header. */
function refreshCookie(res: Response): string | undefined {
  const raw = res.headers["set-cookie"] as unknown as string[] | undefined;
  const entry = raw?.find((c) => c.startsWith(`${cookieName}=`));
  return entry?.split(";")[0]?.split("=")[1];
}

const asCookie = (value: string) => `${cookieName}=${value}`;

beforeAll(async () => {
  // Ensure a clean slate for this email (cascades to any owned rows).
  await prisma.user.deleteMany({ where: { email } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

describe("auth", () => {
  let accessToken = "";
  let firstRefresh = "";

  it("registers a new user (201) and sets a refresh cookie", async () => {
    const res = await request(app)
      .post(`${AUTH_PATH}/register`)
      .send({ email, password, name });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email, name, role: "USER" });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(typeof res.body.accessToken).toBe("string");
    expect(refreshCookie(res)).toBeTruthy();
  });

  it("rejects a duplicate registration (409)", async () => {
    const res = await request(app)
      .post(`${AUTH_PATH}/register`)
      .send({ email, password, name });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("rejects an invalid body (400)", async () => {
    const res = await request(app)
      .post(`${AUTH_PATH}/register`)
      .send({ email: "not-an-email", password: "short", name: "" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects wrong credentials (401)", async () => {
    const res = await request(app)
      .post(`${AUTH_PATH}/login`)
      .send({ email, password: "wrongpassword" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("logs in with correct credentials (200)", async () => {
    const res = await request(app).post(`${AUTH_PATH}/login`).send({ email, password });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
    accessToken = res.body.accessToken;
    firstRefresh = refreshCookie(res) ?? "";
    expect(accessToken).toBeTruthy();
    expect(firstRefresh).toBeTruthy();
  });

  it("rejects /me without a token (401)", async () => {
    const res = await request(app).get(`${AUTH_PATH}/me`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("MISSING_TOKEN");
  });

  it("returns the profile from /me with a bearer token (200)", async () => {
    const res = await request(app)
      .get(`${AUTH_PATH}/me`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
  });

  it("rotates the refresh token (200) and detects reuse of the old one (401)", async () => {
    const rotated = await request(app)
      .post(`${AUTH_PATH}/refresh`)
      .set("Cookie", asCookie(firstRefresh));

    expect(rotated.status).toBe(200);
    expect(typeof rotated.body.accessToken).toBe("string");
    const newRefresh = refreshCookie(rotated);
    expect(newRefresh).toBeTruthy();
    expect(newRefresh).not.toBe(firstRefresh);

    // Replaying the now-rotated token is reuse → 401.
    const reused = await request(app)
      .post(`${AUTH_PATH}/refresh`)
      .set("Cookie", asCookie(firstRefresh));

    expect(reused.status).toBe(401);
    expect(reused.body.error.code).toBe("REFRESH_TOKEN_REUSED");
  });

  it("logs out (204)", async () => {
    const login = await request(app).post(`${AUTH_PATH}/login`).send({ email, password });
    const cookie = refreshCookie(login) ?? "";

    const res = await request(app)
      .post(`${AUTH_PATH}/logout`)
      .set("Cookie", asCookie(cookie));

    expect(res.status).toBe(204);
  });
});
