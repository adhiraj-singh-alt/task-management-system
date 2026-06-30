import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";
import { ERROR_CODES, ERROR_MESSAGES } from "../constants/errors.js";
import { assignableUserSelect, publicUserSelect } from "../utils/userSelect.js";

/**
 * Admin-facing user reads. Access control (ADMIN-only) is enforced at the route
 * via requireRole, so these don't take the acting user.
 */

export async function list() {
  return prisma.user.findMany({ select: publicUserSelect, orderBy: { createdAt: "desc" } });
}

/**
 * Lightweight user list for the assignee picker — available to any
 * authenticated user (route is mounted before the ADMIN gate). Returns only the
 * narrow `assignableUserSelect` fields.
 */
export async function listAssignable() {
  return prisma.user.findMany({ select: assignableUserSelect, orderBy: { name: "asc" } });
}

export async function getById(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: publicUserSelect });
  if (!user) {
    throw AppError.notFound(ERROR_MESSAGES.RESOURCE_NOT_FOUND, ERROR_CODES.USER_NOT_FOUND);
  }
  return user;
}
