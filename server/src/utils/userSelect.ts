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
