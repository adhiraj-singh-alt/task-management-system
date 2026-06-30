import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";
import { ERROR_CODES, ERROR_MESSAGES } from "../constants/errors.js";
import { invalidateAllTasks } from "./taskCache.js";
import type { CreateTagInput, UpdateTagInput } from "../validators/tag.validator.js";

// Tags are a global, shared catalogue (no per-user ownership). Reads are open to
// any authenticated user; writes are ADMIN-only (gated in the routes).

function notFound(): never {
  throw AppError.notFound(ERROR_MESSAGES.TAG_NOT_FOUND, ERROR_CODES.TAG_NOT_FOUND);
}

export async function list() {
  return prisma.tag.findMany({ orderBy: { name: "asc" } });
}

export async function getById(id: string) {
  const tag = await prisma.tag.findUnique({ where: { id } });
  if (!tag) notFound();
  return tag;
}

export async function create(input: CreateTagInput) {
  // Duplicate name (@unique) surfaces as 409 via Prisma mapping.
  return prisma.tag.create({ data: { name: input.name } });
}

export async function update(id: string, input: UpdateTagInput) {
  await getById(id);
  const tag = await prisma.tag.update({
    where: { id },
    data: { ...(input.name !== undefined ? { name: input.name } : {}) },
  });
  // Task payloads embed tag {name}; a shared tag change can affect every user's
  // cached tasks, so invalidate them all.
  await invalidateAllTasks();
  return tag;
}

export async function remove(id: string): Promise<void> {
  await getById(id);
  await prisma.tag.delete({ where: { id } });
  await invalidateAllTasks();
}
