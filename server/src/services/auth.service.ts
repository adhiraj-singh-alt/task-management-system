import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";
import { ERROR_CODES, ERROR_MESSAGES } from "../constants/errors.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { publicUserSelect, type PublicUser } from "../utils/userSelect.js";
import {
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from "./token.service.js";
import type { RegisterInput, LoginInput } from "../validators/auth.validator.js";

/**
 * Auth business logic: user creation, credential checks, and profile reads.
 * Composes the token service so callers (controllers) only deal with HTTP
 * concerns (cookies, status codes). The password hash is never returned.
 */

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

/** Register a new user (always role USER) and issue a fresh token pair. */
export async function register(input: RegisterInput): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw AppError.conflict(ERROR_MESSAGES.EMAIL_TAKEN, ERROR_CODES.EMAIL_TAKEN);
  }

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
      role: "USER",
    },
    select: publicUserSelect,
  });

  return {
    user,
    accessToken: signAccessToken(user),
    refreshToken: await issueRefreshToken(user.id),
  };
}

/** Verify email + password and issue a fresh token pair. */
export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // Same error whether the user is missing or the password is wrong (no enumeration).
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw AppError.unauthorized(
      ERROR_MESSAGES.INVALID_CREDENTIALS,
      ERROR_CODES.INVALID_CREDENTIALS,
    );
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    },
    accessToken: signAccessToken(user),
    refreshToken: await issueRefreshToken(user.id),
  };
}

/** Rotate a refresh token and mint a new access token. */
export async function refresh(
  rawToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const { userId, role, newRawToken } = await rotateRefreshToken(rawToken);
  return {
    accessToken: signAccessToken({ id: userId, role }),
    refreshToken: newRawToken,
  };
}

/** Revoke a refresh token. Idempotent. */
export async function logout(rawToken: string): Promise<void> {
  await revokeRefreshToken(rawToken);
}

/** Load the public profile for an authenticated user. */
export async function getProfile(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: publicUserSelect,
  });
  if (!user) {
    throw AppError.unauthorized(ERROR_MESSAGES.USER_NOT_FOUND, ERROR_CODES.USER_NOT_FOUND);
  }
  return user;
}
