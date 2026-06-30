import type { Prisma, Role } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";
import { ERROR_CODES, ERROR_MESSAGES } from "../constants/errors.js";
import { ownerScope } from "../utils/ownership.js";
import { invalidateTasks, readThroughItem, readThroughList } from "./taskCache.js";
import type {
  CreateTaskInput,
  UpdateTaskInput,
  ListTasksQuery,
} from "../validators/task.validator.js";

type AuthUser = { id: string; role: Role };

// Subtasks are leaves (one-level nesting): include their own category/tags but
// not a further `subtasks` level.
const subtaskInclude = {
  category: { select: { id: true, name: true, color: true } },
  tags: { select: { tag: { select: { id: true, name: true } } } },
} satisfies Prisma.TaskInclude;

const taskInclude = {
  category: { select: { id: true, name: true, color: true } },
  tags: { select: { tag: { select: { id: true, name: true } } } },
  subtasks: { orderBy: { createdAt: "asc" }, include: subtaskInclude },
} satisfies Prisma.TaskInclude;

type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;
type SubtaskWithRelations = Prisma.TaskGetPayload<{ include: typeof subtaskInclude }>;

/** Flatten the TaskTag join rows into a plain `tags: [{id,name}]` array. */
function serializeLeaf(task: SubtaskWithRelations) {
  const { tags, ...rest } = task;
  return { ...rest, tags: tags.map((t) => t.tag) };
}

/** Serialize a task plus its nested subtasks and a completion rollup. */
function serializeTask(task: TaskWithRelations) {
  const { tags, subtasks, ...rest } = task;
  return {
    ...rest,
    tags: tags.map((t) => t.tag),
    subtasks: subtasks.map(serializeLeaf),
    subtaskCount: subtasks.length,
    completedSubtaskCount: subtasks.filter((s) => s.status === "DONE").length,
  };
}

// --- Referenced-resource checks. Parent tasks are owned (must belong to the
//     task's owner); categories and tags are a shared global catalogue, so we
//     only verify they exist. ----------------------------------------------------

async function assertCategoryExists(categoryId: string): Promise<void> {
  const found = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  if (!found) {
    throw AppError.notFound(ERROR_MESSAGES.CATEGORY_NOT_FOUND, ERROR_CODES.CATEGORY_NOT_FOUND);
  }
}

async function assertTagsExist(tagIds: string[]): Promise<void> {
  const ids = [...new Set(tagIds)];
  const count = await prisma.tag.count({ where: { id: { in: ids } } });
  if (count !== ids.length) {
    throw AppError.notFound(ERROR_MESSAGES.TAG_NOT_FOUND, ERROR_CODES.TAG_NOT_FOUND);
  }
}

async function assertParentOwned(
  ownerId: string,
  parentId: string,
  selfId?: string,
): Promise<void> {
  if (selfId && parentId === selfId) {
    throw AppError.badRequest(
      ERROR_MESSAGES.PARENT_TASK_NOT_FOUND,
      ERROR_CODES.PARENT_TASK_NOT_FOUND,
    );
  }
  const found = await prisma.task.findFirst({
    where: { id: parentId, userId: ownerId },
    select: { id: true, parentId: true },
  });
  if (!found) {
    throw AppError.notFound(
      ERROR_MESSAGES.PARENT_TASK_NOT_FOUND,
      ERROR_CODES.PARENT_TASK_NOT_FOUND,
    );
  }
  // One-level limit: the parent must itself be a top-level task.
  if (found.parentId !== null) {
    throw AppError.badRequest(
      ERROR_MESSAGES.SUBTASK_NESTING_NOT_ALLOWED,
      ERROR_CODES.SUBTASK_NESTING_NOT_ALLOWED,
    );
  }
}

// --- CRUD -------------------------------------------------------------------

export async function list(user: AuthUser, q: ListTasksQuery) {
  return readThroughList(user, q, () => listFromDb(user, q));
}

async function listFromDb(user: AuthUser, q: ListTasksQuery) {
  const where: Prisma.TaskWhereInput = {
    ...ownerScope(user),
    ...(q.status ? { status: q.status } : {}),
    ...(q.priority ? { priority: q.priority } : {}),
    ...(q.categoryId ? { categoryId: q.categoryId } : {}),
    ...(q.parentId === "null"
      ? { parentId: null }
      : q.parentId
        ? { parentId: q.parentId }
        : {}),
    ...(q.tag ? { tags: { some: { tagId: q.tag } } } : {}),
    ...(q.search
      ? {
          OR: [
            { title: { contains: q.search, mode: "insensitive" } },
            { description: { contains: q.search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(q.dueBefore || q.dueAfter
      ? {
          dueDate: {
            ...(q.dueAfter ? { gte: q.dueAfter } : {}),
            ...(q.dueBefore ? { lte: q.dueBefore } : {}),
          },
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: { [q.sortBy]: q.order },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.task.count({ where }),
  ]);

  return { items: items.map(serializeTask), total, page: q.page, limit: q.limit };
}

export async function getById(user: AuthUser, id: string) {
  return readThroughItem(user, id, () => getByIdFromDb(user, id));
}

async function getByIdFromDb(user: AuthUser, id: string) {
  const task = await prisma.task.findFirst({
    where: { id, ...ownerScope(user) },
    include: taskInclude,
  });
  if (!task) {
    throw AppError.notFound(ERROR_MESSAGES.TASK_NOT_FOUND, ERROR_CODES.TASK_NOT_FOUND);
  }
  return serializeTask(task);
}

export async function create(user: AuthUser, input: CreateTaskInput) {
  const ownerId = user.id; // tasks are created under the acting user
  if (input.categoryId) await assertCategoryExists(input.categoryId);
  if (input.parentId) await assertParentOwned(ownerId, input.parentId);
  if (input.tagIds?.length) await assertTagsExist(input.tagIds);

  const data: Prisma.TaskUncheckedCreateInput = {
    userId: ownerId,
    title: input.title,
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.priority ? { priority: input.priority } : {}),
    ...(input.dueDate ? { dueDate: input.dueDate } : {}),
    ...(input.status === "DONE" ? { completedAt: new Date() } : {}),
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    ...(input.parentId ? { parentId: input.parentId } : {}),
    ...(input.metadata ? { metadata: input.metadata as Prisma.InputJsonValue } : {}),
    ...(input.tagIds?.length
      ? { tags: { create: input.tagIds.map((tagId) => ({ tagId })) } }
      : {}),
  };

  const task = await prisma.task.create({ data, include: taskInclude });
  await invalidateTasks(ownerId);
  return serializeTask(task);
}

export async function update(user: AuthUser, id: string, input: UpdateTaskInput) {
  const existing = await prisma.task.findFirst({
    where: { id, ...ownerScope(user) },
    select: { id: true, userId: true },
  });
  if (!existing) {
    throw AppError.notFound(ERROR_MESSAGES.TASK_NOT_FOUND, ERROR_CODES.TASK_NOT_FOUND);
  }

  // Referenced resources must belong to the task's owner (not necessarily the
  // acting user, since an ADMIN may edit someone else's task).
  const ownerId = existing.userId;
  if (input.categoryId) await assertCategoryExists(input.categoryId);
  if (input.parentId) {
    // One-level limit: a task that already has subtasks can't become a subtask.
    const childCount = await prisma.task.count({ where: { parentId: id } });
    if (childCount > 0) {
      throw AppError.badRequest(
        ERROR_MESSAGES.SUBTASK_NESTING_NOT_ALLOWED,
        ERROR_CODES.SUBTASK_NESTING_NOT_ALLOWED,
      );
    }
    await assertParentOwned(ownerId, input.parentId, id);
  }
  if (input.tagIds?.length) await assertTagsExist(input.tagIds);

  const data: Prisma.TaskUncheckedUpdateInput = {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
    ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
    ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
    ...(input.metadata !== undefined
      ? { metadata: input.metadata as Prisma.InputJsonValue }
      : {}),
    // Setting status to DONE stamps completedAt; any other status clears it.
    ...(input.status !== undefined
      ? { status: input.status, completedAt: input.status === "DONE" ? new Date() : null }
      : {}),
    // Replacing tags rewrites the join rows atomically within this update.
    ...(input.tagIds !== undefined
      ? { tags: { deleteMany: {}, create: input.tagIds.map((tagId) => ({ tagId })) } }
      : {}),
  };

  const task = await prisma.task.update({ where: { id }, data, include: taskInclude });
  await invalidateTasks(ownerId);
  return serializeTask(task);
}

export async function remove(user: AuthUser, id: string): Promise<void> {
  const existing = await prisma.task.findFirst({
    where: { id, ...ownerScope(user) },
    select: { id: true, userId: true },
  });
  if (!existing) {
    throw AppError.notFound(ERROR_MESSAGES.TASK_NOT_FOUND, ERROR_CODES.TASK_NOT_FOUND);
  }
  await prisma.task.delete({ where: { id } });
  await invalidateTasks(existing.userId);
}
