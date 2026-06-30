import type { Prisma } from "../../generated/prisma/client.js";

/** Public user fields safe to expose to clients (never the password hash). */
export const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

/**
 * Minimal user fields for the assignee picker — exposed to any authenticated
 * user (not just ADMINs), so deliberately narrow: enough to identify a person
 * in a dropdown, nothing more.
 */
export const assignableUserSelect = {
  id: true,
  name: true,
  email: true,
} satisfies Prisma.UserSelect;

export type AssignableUser = Prisma.UserGetPayload<{ select: typeof assignableUserSelect }>;
