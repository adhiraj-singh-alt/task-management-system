import { z } from "zod";
import { TaskStatus, TaskPriority } from "../../generated/prisma/client.js";
import { paginationSchema } from "./common.validator.js";

/** Body/query schemas for the Tasks endpoints. */

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(TaskStatus).optional(),
  priority: z.enum(TaskPriority).optional(),
  dueDate: z.coerce.date().optional(),
  categoryId: z.uuid().optional(),
  // null (or omitted) → a top-level task; a uuid nests it under that parent.
  parentId: z.uuid().nullable().optional(),
  tagIds: z.array(z.uuid()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  // null clears the parent (promotes a subtask back to top-level); a uuid re-parents it.
  parentId: z.uuid().nullable().optional(),
});

export const listTasksQuerySchema = paginationSchema.extend({
  status: z.enum(TaskStatus).optional(),
  priority: z.enum(TaskPriority).optional(),
  categoryId: z.uuid().optional(),
  // "null" → top-level tasks only; a uuid → children of that task.
  parentId: z.union([z.literal("null"), z.uuid()]).optional(),
  tag: z.uuid().optional(), // filter by a tag id
  search: z.string().min(1).optional(),
  dueBefore: z.coerce.date().optional(),
  dueAfter: z.coerce.date().optional(),
  sortBy: z.enum(["createdAt", "dueDate", "priority", "title"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
