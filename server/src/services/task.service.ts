import type { Prisma, Role } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";
import { ERROR_CODES, ERROR_MESSAGES } from "../constants/errors.js";
import { ownerScope, taskAccessScope } from "../utils/ownership.js";
import { invalidateTasks, readThroughList } from "./taskCache.js";
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
  assignedTo: { select: { id: true, name: true, email: true } },
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

async function assertAssigneeExists(assignedToId: string): Promise<void> {
  const found = await prisma.user.findUnique({
    where: { id: assignedToId },
    select: { id: true },
  });
  if (!found) {
    throw AppError.notFound(ERROR_MESSAGES.ASSIGNEE_NOT_FOUND, ERROR_CODES.ASSIGNEE_NOT_FOUND);
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
    // Owner OR assignee (USER) / everything (ADMIN). Wrapped in AND so it
    // doesn't collide with the search `OR` clause below.
    AND: [taskAccessScope(user)],
    ...(q.status ? { status: q.status } : {}),
    ...(q.priority ? { priority: q.priority } : {}),
    ...(q.categoryId ? { categoryId: q.categoryId } : {}),
    ...(q.assignedToId ? { assignedToId: q.assignedToId } : {}),
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
  const task = await prisma.task.findFirst({
    where: { id, AND: [taskAccessScope(user)] },
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
  if (input.assignedToId) await assertAssigneeExists(input.assignedToId);
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
    ...(input.assignedToId ? { assignedToId: input.assignedToId } : {}),
    ...(input.parentId ? { parentId: input.parentId } : {}),
    ...(input.metadata ? { metadata: input.metadata as Prisma.InputJsonValue } : {}),
    ...(input.tagIds?.length
      ? { tags: { create: input.tagIds.map((tagId) => ({ tagId })) } }
      : {}),
  };

  const task = await prisma.task.create({ data, include: taskInclude });
  await invalidateTasks(ownerId, input.assignedToId);
  return serializeTask(task);
}

export async function update(user: AuthUser, id: string, input: UpdateTaskInput) {
  // Owner, assignee, or ADMIN may reach a task for a general update.
  const existing = await prisma.task.findFirst({
    where: { id, AND: [taskAccessScope(user)] },
    select: { id: true, userId: true, assignedToId: true },
  });
  if (!existing) {
    throw AppError.notFound(ERROR_MESSAGES.TASK_NOT_FOUND, ERROR_CODES.TASK_NOT_FOUND);
  }

  // Reassigning is owner/admin only — an assignee can edit the task but not
  // hand it to someone else.
  const isOwnerOrAdmin = user.role === "ADMIN" || existing.userId === user.id;
  if (input.assignedToId !== undefined && !isOwnerOrAdmin) {
    throw AppError.forbidden(ERROR_MESSAGES.FORBIDDEN, ERROR_CODES.FORBIDDEN);
  }
  if (input.assignedToId) await assertAssigneeExists(input.assignedToId);

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

  const data: Prisma.TaskUncheckedUpdateManyInput = {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
    ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
    ...(input.assignedToId !== undefined ? { assignedToId: input.assignedToId } : {}),
    ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
    ...(input.metadata !== undefined
      ? { metadata: input.metadata as Prisma.InputJsonValue }
      : {}),
    // Setting status to DONE stamps completedAt; any other status clears it.
    ...(input.status !== undefined
      ? { status: input.status, completedAt: input.status === "DONE" ? new Date() : null }
      : {}),
    // Optimistic-lock bump: every accepted update advances the version.
    version: { increment: 1 },
  };

  // Compare-and-set on version, wrapped in an interactive transaction so the tag
  // rewrite is atomic with the guarded update. Prisma's `update` where clause
  // only accepts unique fields, so the version guard uses `updateMany` (arbitrary
  // filter + affected-row count) instead.
  const task = await prisma.$transaction(async (tx) => {
    const { count } = await tx.task.updateMany({
      where: { id, version: input.version },
      data,
    });
    if (count === 0) {
      // The row exists and is accessible (checked above), so a zero count means
      // another write advanced the version between the client's read and now.
      throw AppError.conflict(
        ERROR_MESSAGES.TASK_VERSION_CONFLICT,
        ERROR_CODES.TASK_VERSION_CONFLICT,
      );
    }
    // Replacing tags rewrites the join rows (updateMany can't nest writes).
    if (input.tagIds !== undefined) {
      await tx.taskTag.deleteMany({ where: { taskId: id } });
      if (input.tagIds.length) {
        await tx.taskTag.createMany({
          data: input.tagIds.map((tagId) => ({ taskId: id, tagId })),
        });
      }
    }
    return tx.task.findUniqueOrThrow({ where: { id }, include: taskInclude });
  });

  // Invalidate the owner, the previous assignee, and (if reassigned) the new one.
  await invalidateTasks(ownerId, existing.assignedToId, task.assignedToId);
  return serializeTask(task);
}

export async function remove(user: AuthUser, id: string): Promise<void> {
  // Deleting is owner/admin only (stricter than the general-update scope).
  const existing = await prisma.task.findFirst({
    where: { id, ...ownerScope(user) },
    select: { id: true, userId: true, assignedToId: true },
  });
  if (!existing) {
    throw AppError.notFound(ERROR_MESSAGES.TASK_NOT_FOUND, ERROR_CODES.TASK_NOT_FOUND);
  }
  await prisma.task.delete({ where: { id } });
  await invalidateTasks(existing.userId, existing.assignedToId);
}
