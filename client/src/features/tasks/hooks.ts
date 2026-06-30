import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  AssignableUser,
  Category,
  Paginated,
  Tag,
  Task,
  TaskPriority,
  TaskStatus,
} from "@/lib/types";

export interface TaskListParams {
  search: string;
  status: TaskStatus | "";
  priority: TaskPriority | "";
  categoryId: string;
  // A uuid → tasks assigned to that user; "" → no filter.
  assignedToId?: string;
  // "null" → top-level only; a uuid → children of that task; "" → no filter.
  parentId?: string;
  page: number;
  limit: number;
  sortBy: "createdAt" | "dueDate" | "priority" | "title";
  order: "asc" | "desc";
}

/** Drop empty filter values so we don't send `?status=` etc. */
function toQuery(params: TaskListParams): Record<string, string | number> {
  const q: Record<string, string | number> = {
    page: params.page,
    limit: params.limit,
    sortBy: params.sortBy,
    order: params.order,
  };
  if (params.search) q.search = params.search;
  if (params.status) q.status = params.status;
  if (params.priority) q.priority = params.priority;
  if (params.categoryId) q.categoryId = params.categoryId;
  if (params.assignedToId) q.assignedToId = params.assignedToId;
  if (params.parentId) q.parentId = params.parentId;
  return q;
}

export function useTasks(params: TaskListParams) {
  return useQuery({
    queryKey: ["tasks", params],
    queryFn: async () => {
      const res = await api.get<Paginated<Task>>("/tasks", { params: toQuery(params) });
      return res.data;
    },
    placeholderData: keepPreviousData,
  });
}

/** Top-level tasks for the parent picker (only enabled while a dialog is open). */
export function useTaskOptions(enabled: boolean) {
  return useQuery({
    queryKey: ["tasks", "options"],
    queryFn: async () => {
      const res = await api.get<Paginated<Task>>("/tasks", {
        params: { parentId: "null", limit: 100, sortBy: "title", order: "asc" },
      });
      return res.data.items;
    },
    enabled,
    staleTime: 60_000,
  });
}

/** Payload for create/update. Omit a field to leave it unset/unchanged. */
export interface TaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  categoryId?: string;
  assignedToId?: string | null; // uuid to assign to a user; null to unassign.
  tagIds?: string[];
  parentId?: string | null; // uuid to nest under a parent; null to detach.
  metadata?: Record<string, string>; // ad-hoc custom fields stored as JSONB on the task.
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TaskInput) =>
      api.post<{ task: Task }>("/tasks", input).then((r) => r.data.task),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TaskInput }) =>
      api.patch<{ task: Task }>(`/tasks/${id}`, input).then((r) => r.data.task),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () =>
      api.get<{ categories: Category[] }>("/categories").then((r) => r.data.categories),
    staleTime: 5 * 60_000,
  });
}

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: () => api.get<{ tags: Tag[] }>("/tags").then((r) => r.data.tags),
    staleTime: 5 * 60_000,
  });
}

/** Users available to assign a task to. Only fetched while a form is open. */
export function useAssignableUsers(enabled: boolean) {
  return useQuery({
    queryKey: ["users", "assignable"],
    queryFn: () =>
      api.get<{ users: AssignableUser[] }>("/users/assignable").then((r) => r.data.users),
    enabled,
    staleTime: 5 * 60_000,
  });
}
