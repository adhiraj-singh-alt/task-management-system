import type { TaskPriority, TaskStatus } from "@/lib/types";

export const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "TODO", label: "To do" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "DONE", label: "Done" },
  { value: "ARCHIVED", label: "Archived" },
];

export const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  ARCHIVED: "Archived",
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

// Semantic colors (explicit, not theme tokens) with dark-mode variants.
export const STATUS_BADGE: Record<TaskStatus, string> = {
  TODO: "border-transparent bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  IN_PROGRESS:
    "border-transparent bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  DONE: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  ARCHIVED:
    "border-transparent bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

export const PRIORITY_BADGE: Record<TaskPriority, string> = {
  LOW: "border-transparent bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  MEDIUM: "border-transparent bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  HIGH: "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  URGENT: "border-transparent bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};
