import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ListTodo, Plus } from "lucide-react";
import type { Task } from "@/lib/types";
import { apiErrorMessage } from "@/lib/api";
import {
  useCategories,
  useTags,
  useTasks,
  type TaskListParams,
} from "./hooks";
import { TaskFilters } from "./TaskFilters";
import { TaskTable } from "./TaskTable";
import { TaskFormDialog } from "./TaskFormDialog";
import { TaskDetailDialog } from "./TaskDetailDialog";
import { DeleteTaskDialog } from "./DeleteTaskDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const INITIAL: TaskListParams = {
  search: "",
  status: "",
  priority: "",
  categoryId: "",
  assignedToId: "",
  parentId: "null", // top-level tasks only; subtasks come nested per row
  page: 1,
  limit: 10,
  sortBy: "createdAt",
  order: "desc",
};

export function TasksPage() {
  const [params, setParams] = useState<TaskListParams>(INITIAL);
  const [searchInput, setSearchInput] = useState("");

  // Debounce the search box into the query params (and reset to page 1).
  useEffect(() => {
    const t = setTimeout(() => {
      setParams((p) => (p.search === searchInput ? p : { ...p, search: searchInput, page: 1 }));
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const patch = (next: Partial<TaskListParams>) => setParams((p) => ({ ...p, ...next }));

  const tasksQuery = useTasks(params);
  const categoriesQuery = useCategories();
  const tagsQuery = useTags();

  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [subtaskParentId, setSubtaskParentId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<Task | null>(null);
  const [viewParent, setViewParent] = useState<Task | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  const openView = (task: Task, parent?: Task) => {
    setViewTarget(task);
    setViewParent(parent ?? null);
    setViewOpen(true);
  };

  const openCreate = () => {
    setEditingTask(null);
    setSubtaskParentId(null);
    setFormOpen(true);
  };
  const openEdit = (task: Task) => {
    setEditingTask(task);
    setSubtaskParentId(null);
    setFormOpen(true);
  };
  const openAddSubtask = (parent: Task) => {
    setEditingTask(null);
    setSubtaskParentId(parent.id);
    setFormOpen(true);
  };
  const openDelete = (task: Task) => {
    setDeleteTarget(task);
    setDeleteOpen(true);
  };

  const data = tasksQuery.data;
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / params.limit));
  const hasFilters = Boolean(
    params.search ||
      params.status ||
      params.priority ||
      params.categoryId ||
      params.assignedToId,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground text-sm">
            {total} {total === 1 ? "task" : "tasks"}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          New task
        </Button>
      </div>

      <TaskFilters
        params={params}
        searchInput={searchInput}
        onSearchInput={setSearchInput}
        onPatch={patch}
        categories={categoriesQuery.data ?? []}
      />

      <div className="bg-background rounded-lg border">
        {tasksQuery.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : tasksQuery.isError ? (
          <div className="text-destructive p-10 text-center text-sm">
            {apiErrorMessage(tasksQuery.error, "Failed to load tasks")}
          </div>
        ) : data && data.items.length > 0 ? (
          <TaskTable
            tasks={data.items}
            onEdit={openEdit}
            onDelete={openDelete}
            onAddSubtask={openAddSubtask}
            onView={openView}
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <div className="bg-muted rounded-full p-3">
              <ListTodo className="text-muted-foreground size-6" />
            </div>
            <div>
              <p className="font-medium">
                {hasFilters ? "No tasks match your filters" : "No tasks yet"}
              </p>
              <p className="text-muted-foreground text-sm">
                {hasFilters
                  ? "Try adjusting your search or filters."
                  : "Create your first task to get started."}
              </p>
            </div>
            {!hasFilters && (
              <Button onClick={openCreate} variant="outline">
                <Plus className="size-4" />
                New task
              </Button>
            )}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Page {params.page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={params.page <= 1}
              onClick={() => patch({ page: params.page - 1 })}
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={params.page >= totalPages}
              onClick={() => patch({ page: params.page + 1 })}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <TaskDetailDialog
        open={viewOpen}
        onOpenChange={setViewOpen}
        task={viewTarget}
        parent={viewParent}
        onEdit={(t) => {
          setViewOpen(false);
          openEdit(t);
        }}
        onDelete={(t) => {
          setViewOpen(false);
          openDelete(t);
        }}
        onAddSubtask={(parent) => {
          setViewOpen(false);
          openAddSubtask(parent);
        }}
        onSelectTask={openView}
      />

      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editingTask}
        defaultParentId={subtaskParentId}
        categories={categoriesQuery.data ?? []}
        tags={tagsQuery.data ?? []}
      />
      <DeleteTaskDialog task={deleteTarget} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}
