/** API types mirroring the backend responses (see server/src). */

export type Role = "USER" | "ADMIN";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

/** Minimal user shape from `GET /users/assignable` (the assignee picker). */
export type AssignableUser = Pick<User, "id" | "name" | "email">;

export interface Category {
  id: string;
  userId: string;
  name: string;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
}

export interface Task {
  id: string;
  userId: string;
  assignedToId: string | null;
  parentId: string | null;
  categoryId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  completedAt: string | null;
  metadata: Record<string, unknown>;
  // Optimistic-lock counter. Echo it back on update; a stale value → 409.
  version: number;
  createdAt: string;
  updatedAt: string;
  category: Pick<Category, "id" | "name" | "color"> | null;
  // Present on top-level tasks; omitted on nested subtasks (leaves carry only the id).
  assignedTo?: AssignableUser | null;
  tags: Pick<Tag, "id" | "name">[];
  // Present on top-level tasks; absent on nested subtasks (which are leaves).
  subtasks?: Task[];
  subtaskCount?: number;
  completedSubtaskCount?: number;
}

/** Shape of `GET /tasks`. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

/** Login/register response. */
export interface AuthResponse {
  user: User;
  accessToken: string;
}

/** Stable error contract: `{ error: { message, code? } }`. */
export interface ApiError {
  error: { message: string; code?: string };
}

// --- Reports ---------------------------------------------------------------

export interface ReportSummary {
  summary: {
    total: number;
    completed: number;
    open: number;
    archived: number;
    overdue: number;
    completionRate: number;
  };
  byStatus: Record<TaskStatus, number>;
  byPriority: Record<TaskPriority, number>;
}

export interface CategoryReport {
  categories: {
    categoryId: string | null;
    categoryName: string | null;
    count: number;
  }[];
}

export interface CompletionTrend {
  days: number;
  points: { day: string; count: number }[];
}
