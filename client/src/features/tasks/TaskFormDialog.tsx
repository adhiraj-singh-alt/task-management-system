import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Category, Tag, Task } from "@/lib/types";
import { apiErrorMessage } from "@/lib/api";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "./constants";
import { useCreateTask, useTaskOptions, useUpdateTask, type TaskInput } from "./hooks";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "none";

const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  dueDate: z.string().optional(),
  categoryId: z.string().optional(),
  parentId: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  /** Preset parent when adding a subtask from a task's row menu. */
  defaultParentId?: string | null;
  categories: Category[];
  tags: Tag[];
}

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  defaultParentId,
  categories,
  tags,
}: Props) {
  const isEdit = Boolean(task);
  const isSubtaskCreate = !isEdit && Boolean(defaultParentId);
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  // Ad-hoc custom fields, persisted to task.metadata. Kept as ordered rows
  // (not react-hook-form) because the keys themselves are user-defined.
  const [fields, setFields] = useState<{ key: string; value: string }[]>([]);

  // A task that already has children can't be reparented (one-level rule).
  const hasChildren = (task?.subtaskCount ?? 0) > 0;
  const parentOptions = useTaskOptions(open && !hasChildren);

  const { register, handleSubmit, control, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", status: "TODO", priority: "MEDIUM" },
  });

  // Sync form to the task being edited (or reset for create) whenever opened.
  useEffect(() => {
    if (!open) return;
    reset({
      title: task?.title ?? "",
      description: task?.description ?? "",
      status: task?.status ?? "TODO",
      priority: task?.priority ?? "MEDIUM",
      dueDate: task?.dueDate ? task.dueDate.slice(0, 10) : "",
      categoryId: task?.categoryId ?? "",
      parentId: task?.parentId ?? defaultParentId ?? "",
    });
    setSelectedTags(task?.tags.map((t) => t.id) ?? []);
    setFields(
      task?.metadata
        ? Object.entries(task.metadata).map(([key, value]) => ({
            key,
            value: String(value),
          }))
        : [],
    );
  }, [open, task, defaultParentId, reset]);

  const onSubmit = async (values: FormValues) => {
    const input: TaskInput = {
      title: values.title,
      status: values.status,
      priority: values.priority,
      tagIds: selectedTags,
    };
    if (values.description) input.description = values.description;
    if (values.dueDate) input.dueDate = values.dueDate;
    if (values.categoryId) input.categoryId = values.categoryId;
    // Only manage parentId when reparenting is possible: send the chosen id,
    // or null to detach. Skip entirely for tasks that already have children.
    if (!hasChildren) input.parentId = values.parentId ? values.parentId : null;

    // Trim keys, drop empty-key rows, last write wins on duplicate keys.
    const metadata = fields.reduce<Record<string, string>>((acc, { key, value }) => {
      const k = key.trim();
      if (k) acc[k] = value;
      return acc;
    }, {});
    // Create: only send if non-empty. Edit: always send (even {}) so cleared
    // fields are removed — the backend replaces metadata wholesale.
    if (isEdit || Object.keys(metadata).length > 0) input.metadata = metadata;

    try {
      if (task) {
        await updateTask.mutateAsync({ id: task.id, input });
        toast.success("Task updated");
      } else {
        await createTask.mutateAsync(input);
        toast.success("Task created");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save task"));
    }
  };

  const toggleTag = (id: string) =>
    setSelectedTags((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );

  const addField = () => setFields((prev) => [...prev, { key: "", value: "" }]);

  const updateField = (
    index: number,
    patch: Partial<{ key: string; value: string }>,
  ) => setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));

  const removeField = (index: number) =>
    setFields((prev) => prev.filter((_, i) => i !== index));

  const saving = createTask.isPending || updateTask.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit task" : isSubtaskCreate ? "New subtask" : "New task"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the details of this task."
              : isSubtaskCreate
                ? "Add a subtask under the selected task."
                : "Add a task to your list."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...register("title")} autoFocus />
            {formState.errors.title && (
              <p className="text-destructive text-sm">{formState.errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} {...register("description")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due date</Label>
              <Input id="dueDate" type="date" {...register("dueDate")} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Controller
                control={control}
                name="categoryId"
                render={({ field }) => (
                  <Select
                    value={field.value || NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>No category</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {!hasChildren && (
            <div className="space-y-2">
              <Label>Parent task</Label>
              <Controller
                control={control}
                name="parentId"
                render={({ field }) => (
                  <Select
                    value={field.value || NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>No parent (top-level)</SelectItem>
                      {(parentOptions.data ?? [])
                        .filter((t) => t.id !== task?.id)
                        .map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.title}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          {tags.length > 0 && (
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const active = selectedTags.includes(tag.id);
                  return (
                    <button
                      type="button"
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input text-muted-foreground hover:bg-accent",
                      )}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Custom fields</Label>
            {fields.length > 0 && (
              <div className="space-y-2">
                {fields.map((field, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      placeholder="Field name"
                      value={field.key}
                      onChange={(e) => updateField(index, { key: e.target.value })}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Value"
                      value={field.value}
                      onChange={(e) => updateField(index, { value: e.target.value })}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeField(index)}
                      aria-label="Remove field"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button type="button" variant="outline" size="sm" onClick={addField}>
              <Plus className="size-4" />
              Add field
            </Button>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
