import { Fragment, useState } from "react";
import { format, isPast, isToday, parseISO } from "date-fns";
import {
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  ListPlus,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PRIORITY_BADGE, PRIORITY_LABEL, STATUS_BADGE, STATUS_LABEL } from "./constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Props {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onAddSubtask: (parent: Task) => void;
  onView: (task: Task, parent?: Task) => void;
}

function DueDate({ task }: { task: Task }) {
  if (!task.dueDate) return <span className="text-muted-foreground">—</span>;
  const d = parseISO(task.dueDate);
  const overdue = task.status !== "DONE" && isPast(d) && !isToday(d);
  return (
    <span className={cn(overdue && "text-destructive font-medium")}>
      {format(d, "MMM d, yyyy")}
    </span>
  );
}

function RowActions({
  task,
  onEdit,
  onDelete,
  onAddSubtask,
}: {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onAddSubtask?: (parent: Task) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          <MoreHorizontal className="size-4" />
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(task)}>
          <Pencil className="size-4" />
          Edit
        </DropdownMenuItem>
        {onAddSubtask && (
          <DropdownMenuItem onClick={() => onAddSubtask(task)}>
            <ListPlus className="size-4" />
            Add subtask
          </DropdownMenuItem>
        )}
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(task)}>
          <Trash2 className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TaskTable({ tasks, onEdit, onDelete, onAddSubtask, onView }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Task</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Due</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const count = task.subtaskCount ?? 0;
            const done = task.completedSubtaskCount ?? 0;
            const hasSubtasks = count > 0;
            const isOpen = expanded.has(task.id);

            return (
              <Fragment key={task.id}>
                <TaskRow
                  task={task}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onAddSubtask={onAddSubtask}
                  onView={onView}
                  leading={
                    hasSubtasks ? (
                      <button
                        type="button"
                        onClick={() => toggle(task.id)}
                        className="text-muted-foreground hover:text-foreground -ml-1 shrink-0"
                        aria-label={isOpen ? "Collapse subtasks" : "Expand subtasks"}
                      >
                        {isOpen ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                      </button>
                    ) : (
                      <span className="inline-block w-4 shrink-0" />
                    )
                  }
                  trailing={
                    hasSubtasks && (
                      <Badge variant="secondary" className="ml-2 shrink-0 tabular-nums">
                        {done}/{count}
                      </Badge>
                    )
                  }
                />

                {isOpen &&
                  task.subtasks?.map((sub) => (
                    <TaskRow
                      key={sub.id}
                      task={sub}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onView={onView}
                      parent={task}
                      subtask
                    />
                  ))}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function TaskRow({
  task,
  onEdit,
  onDelete,
  onAddSubtask,
  onView,
  parent,
  leading,
  trailing,
  subtask = false,
}: {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onAddSubtask?: (parent: Task) => void;
  onView: (task: Task, parent?: Task) => void;
  parent?: Task;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  subtask?: boolean;
}) {
  return (
    <TableRow className={cn(subtask && "bg-muted/30")}>
      <TableCell className="max-w-[320px]">
        <div className="flex items-center">
          {subtask ? (
            <CornerDownRight className="text-muted-foreground mr-2 ml-4 size-4 shrink-0" />
          ) : (
            <span className="mr-2">{leading}</span>
          )}
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => onView(task, parent)}
              className={cn(
                "block max-w-full truncate text-left font-medium hover:underline",
                subtask && "font-normal",
              )}
            >
              {task.title}
            </button>
            {task.tags.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {task.tags.map((t) => (
                  <span
                    key={t.id}
                    className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 text-[11px]"
                  >
                    {t.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          {trailing}
        </div>
      </TableCell>
      <TableCell>
        <Badge className={STATUS_BADGE[task.status]}>{STATUS_LABEL[task.status]}</Badge>
      </TableCell>
      <TableCell>
        <Badge className={PRIORITY_BADGE[task.priority]}>{PRIORITY_LABEL[task.priority]}</Badge>
      </TableCell>
      <TableCell>
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
      </TableCell>
      <TableCell>
        <DueDate task={task} />
      </TableCell>
      <TableCell>
        <RowActions
          task={task}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddSubtask={onAddSubtask}
        />
      </TableCell>
    </TableRow>
  );
}
