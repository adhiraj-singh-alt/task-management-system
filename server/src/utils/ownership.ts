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

/**
 * Access scoping for *tasks*, which (unlike plain owned resources) are visible
 * to both their owner and their assignee. ADMIN sees everything; a USER sees a
 * task they own OR one assigned to them. Combine via `AND` so it composes with
 * other top-level `OR` clauses (e.g. text search) without key collisions:
 *
 *   prisma.task.findMany({ where: { AND: [taskAccessScope(user)], ...filters } })
 *
 * This governs read + general update. Reassigning and deleting stay owner-only
 * (use `ownerScope`).
 */
export function taskAccessScope(user: {
  id: string;
  role: Role;
}): { OR?: { userId?: string; assignedToId?: string }[] } {
  return user.role === "ADMIN"
    ? {}
    : { OR: [{ userId: user.id }, { assignedToId: user.id }] };
}
