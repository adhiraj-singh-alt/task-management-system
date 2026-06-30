import type { Role } from "../../generated/prisma/client.js";

/**
 * Ownership scoping for resource queries. ADMIN sees/edits everything; USER is
 * restricted to rows they own. Spread the result into a Prisma `where` clause:
 *
 *   prisma.task.findMany({ where: { ...ownerScope(user), status } })
 *
 * For single-record access, combine with the id and use `findFirst` so a
 * non-owner gets a clean "not found" instead of a forbidden (no existence leak).
 */
export function ownerScope(user: { id: string; role: Role }): { userId?: string } {
  return user.role === "ADMIN" ? {} : { userId: user.id };
}
