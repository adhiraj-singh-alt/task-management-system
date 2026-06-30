import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";
import { ERROR_CODES, ERROR_MESSAGES } from "../constants/errors.js";
import { invalidateAllTasks } from "./taskCache.js";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "../validators/category.validator.js";

// Categories are a global, shared catalogue (no per-user ownership). Reads are
// open to any authenticated user; writes are ADMIN-only (gated in the routes).

function notFound(): never {
  throw AppError.notFound(ERROR_MESSAGES.CATEGORY_NOT_FOUND, ERROR_CODES.CATEGORY_NOT_FOUND);
}

export async function list() {
  return prisma.category.findMany({ orderBy: { name: "asc" } });
}

export async function getById(id: string) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) notFound();
  return category;
}

export async function create(input: CreateCategoryInput) {
  // Duplicate name (@unique) surfaces as 409 via Prisma mapping.
  return prisma.category.create({
    data: { name: input.name, color: input.color },
  });
}

export async function update(id: string, input: UpdateCategoryInput) {
  await getById(id); // existence check
  const category = await prisma.category.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
    },
  });
  // Task payloads embed category {name,color}; a shared category change can
  // affect every user's cached tasks, so invalidate them all.
  await invalidateAllTasks();
  return category;
}

export async function remove(id: string): Promise<void> {
  await getById(id);
  await prisma.category.delete({ where: { id } });
  await invalidateAllTasks();
}
