import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import type { Role } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { ERROR_CODES, ERROR_MESSAGES } from "../constants/errors.js";

/**
 * Token logic for the auth layer: stateless JWT access tokens plus opaque,
 * rotating refresh tokens stored only as a SHA-256 hash in the database.
 */

export interface AccessTokenPayload {
  /** User id (JWT `sub`). */
  sub: string;
  role: Role;
}

const REFRESH_TTL_MS = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

// --- Access tokens (stateless JWT) ---------------------------------------

/** Sign a short-lived access token for a user. */
export function signAccessToken(user: { id: string; role: Role }): string {
  const options: SignOptions = {
    subject: user.id,
    expiresIn: env.JWT_ACCESS_TTL as SignOptions["expiresIn"],
  };
  return jwt.sign({ role: user.role }, env.JWT_SECRET, options);
}

/** Verify an access token, returning its payload. Throws AppError on failure. */
export function verifyAccessToken(token: string): AccessTokenPayload {
  let decoded: jwt.JwtPayload | string;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw AppError.unauthorized(ERROR_MESSAGES.INVALID_TOKEN, ERROR_CODES.INVALID_TOKEN);
  }
  if (typeof decoded === "string" || !decoded.sub || typeof decoded.role !== "string") {
    throw AppError.unauthorized(ERROR_MESSAGES.INVALID_TOKEN, ERROR_CODES.INVALID_TOKEN);
  }
  return { sub: decoded.sub, role: decoded.role as Role };
}

// --- Refresh tokens (opaque, hashed at rest) -----------------------------

/**
 * Fast hash for refresh tokens. SHA-256 is sufficient here because the raw
 * token is 256 bits of crypto-random entropy (not a low-entropy password), and
 * the digest doubles as the unique lookup key.
 */
function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Issue a new refresh token for a user: persist its hash and return the RAW
 * token (the only moment it exists outside the client's cookie).
 */
export async function issueRefreshToken(userId: string): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });
  return raw;
}

/**
 * Validate and rotate a refresh token. Revokes the presented token and issues a
 * fresh one atomically. Detects reuse of an already-revoked token (a theft
 * signal) and revokes the user's entire active token set in response.
 */
export async function rotateRefreshToken(
  rawOld: string,
): Promise<{ userId: string; role: Role; newRawToken: string }> {
  const tokenHash = hashToken(rawOld);
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, role: true } } },
  });

  if (!existing) {
    throw AppError.unauthorized(
      ERROR_MESSAGES.INVALID_REFRESH_TOKEN,
      ERROR_CODES.INVALID_REFRESH_TOKEN,
    );
  }

  // Reuse of a revoked token => likely theft. Burn all of this user's tokens.
  if (existing.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: existing.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw AppError.unauthorized(
      ERROR_MESSAGES.REFRESH_TOKEN_REUSED,
      ERROR_CODES.REFRESH_TOKEN_REUSED,
    );
  }

  if (existing.expiresAt.getTime() < Date.now()) {
    throw AppError.unauthorized(
      ERROR_MESSAGES.REFRESH_TOKEN_EXPIRED,
      ERROR_CODES.REFRESH_TOKEN_EXPIRED,
    );
  }

  const newRaw = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        userId: existing.userId,
        tokenHash: hashToken(newRaw),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    }),
  ]);

  return { userId: existing.user.id, role: existing.user.role, newRawToken: newRaw };
}

/** Revoke a refresh token if present. Idempotent — never throws on a miss. */
export async function revokeRefreshToken(raw: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(raw), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
