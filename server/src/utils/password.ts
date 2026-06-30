import bcrypt from "bcrypt";
import { env } from "../config/env.js";

/**
 * Password hashing helpers. Kept free of Prisma so the seed script can reuse
 * them without pulling in the runtime client config.
 */

/** Hash a plaintext password with bcrypt (cost from env). */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

/** Constant-time compare of a plaintext password against a stored bcrypt hash. */
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
