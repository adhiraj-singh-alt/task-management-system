import { format, isPast, isToday, parseISO } from "date-fns";
import { ArrowLeft, ListPlus, Pencil, Trash2 } from "lucide-react";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PRIORITY_BADGE, PRIORITY_LABEL, STATUS_BADGE, STATUS_LABEL } from "./constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  /** Parent task, present when viewing a subtask — powers the Back button. */
  parent?: Task | null;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onAddSubtask: (parent: Task) => void;
  /** Re-point the dialog at another task (drill into a subtask, or go back). */
  onSelectTask: (task: Task, parent?: Task) => void;
}

function formatDue(dueDate: string, status: Task["status"]) {
  const d = parseISO(dueDate);
  const overdue = status !== "DONE" && isPast(d) && !isToday(d);
  return { label: format(d, "MMM d, yyyy"), overdue };
}

/** A label + value row in the meta grid. */
function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="text-muted-foreground w-24 shrink-0">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function TaskDetailDialog({
  open,
  onOpenChange,
  task,
  parent,
  onEdit,
  onDelete,
  onAddSubtask,
  onSelectTask,
}: Props) {
  if (!task) return null;

  const isSubtask = task.parentId !== null;
  const count = task.subtaskCount ?? 0;
  const done = task.completedSubtaskCount ?? 0;
  const due = task.dueDate ? formatDue(task.dueDate, task.status) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          {parent && (
            <button
              type="button"
              onClick={() => onSelectTask(parent)}
              className="text-muted-foreground hover:text-foreground -ml-1 flex w-fit items-center gap-1 text-sm"
            >
              <ArrowLeft className="size-4" />
              <span className="max-w-[24rem] truncate">{parent.title}</span>
            </button>
          )}
          <DialogTitle className="pr-6 break-words">{task.title}</DialogTitle>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge className={STATUS_BADGE[task.status]}>{STATUS_LABEL[task.status]}</Badge>
            <Badge className={PRIORITY_BADGE[task.priority]}>
              {PRIORITY_LABEL[task.priority]}
            </Badge>
            {isSubtask && <Badge variant="outline">Subtask</Badge>}
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Description */}
          <div className="text-sm">
            {task.description ? (
              <p className="whitespace-pre-wrap">{task.description}</p>
            ) : (
              <p className="text-muted-foreground italic">No description</p>
            )}
          </div>

          <Separator />

          {/* Meta */}
          <div className="space-y-2">
            {isSubtask && parent && (
              <MetaRow label="Part of">
                <button
                  type="button"
                  onClick={() => onSelectTask(parent)}
                  className="font-medium hover:underline"
                >
                  {parent.title}
                </button>
              </MetaRow>
            )}
            <MetaRow label="Due">
              {due ? (
                <span className={cn(due.overdue && "text-destructive font-medium")}>
                  {due.label}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </MetaRow>
            <MetaRow label="Category">
              {task.category ? (
                <span className="inline-flex items-center gap-1.5">
                  {task.category.color && (
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: task.category.color }}
                    />
                  )}
                  {task.category.name}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </MetaRow>
            <MetaRow label="Tags">
              {task.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {task.tags.map((t) => (
                    <span
                      key={t.id}
                      className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 text-[11px]"
                    >
                      {t.name}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </MetaRow>
            {Object.keys(task.metadata).length > 0 &&
              Object.entries(task.metadata).map(([key, value]) => (
                <MetaRow key={key} label={key}>
                  <span className="break-words">{String(value)}</span>
                </MetaRow>
              ))}
          </div>

          {/* Subtasks */}
          {count > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">Subtasks</h3>
                  <Badge variant="secondary" className="tabular-nums">
                    {done}/{count}
                  </Badge>
                </div>
                <ul className="space-y-1">
                  {task.subtasks?.map((sub) => (
                    <li key={sub.id}>
                      <button
                        type="button"
                        onClick={() => onSelectTask(sub, task)}
                        className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm"
                      >
                        <Badge className={cn(STATUS_BADGE[sub.status], "shrink-0")}>
                          {STATUS_LABEL[sub.status]}
                        </Badge>
                        <span className="truncate">{sub.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          <Separator />

          {/* Timestamps */}
          <div className="text-muted-foreground space-y-1 text-xs">
            <div>Created {format(parseISO(task.createdAt), "MMM d, yyyy 'at' h:mm a")}</div>
            <div>Updated {format(parseISO(task.updatedAt), "MMM d, yyyy 'at' h:mm a")}</div>
            {task.completedAt && (
              <div>
                Completed {format(parseISO(task.completedAt), "MMM d, yyyy 'at' h:mm a")}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => onDelete(task)}
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
          <div className="flex gap-2">
            {!isSubtask && (
              <Button variant="outline" onClick={() => onAddSubtask(task)}>
                <ListPlus className="size-4" />
                Add subtask
              </Button>
            )}
            <Button onClick={() => onEdit(task)}>
              <Pencil className="size-4" />
              Edit
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
