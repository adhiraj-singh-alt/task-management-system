import { ArrowDown, ArrowUp, Search } from "lucide-react";
import type { Category, TaskPriority, TaskStatus } from "@/lib/types";
import type { TaskListParams } from "./hooks";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "./constants";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  params: TaskListParams;
  searchInput: string;
  onSearchInput: (v: string) => void;
  onPatch: (patch: Partial<TaskListParams>) => void;
  categories: Category[];
}

const ALL = "all";

export function TaskFilters({
  params,
  searchInput,
  onSearchInput,
  onPatch,
  categories,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1">
        <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
        <Input
          value={searchInput}
          onChange={(e) => onSearchInput(e.target.value)}
          placeholder="Search tasks…"
          className="pl-8"
        />
      </div>

      <Select
        value={params.status || ALL}
        onValueChange={(v) =>
          onPatch({ status: v === ALL ? "" : (v as TaskStatus), page: 1 })
        }
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {STATUS_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={params.priority || ALL}
        onValueChange={(v) =>
          onPatch({ priority: v === ALL ? "" : (v as TaskPriority), page: 1 })
        }
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All priorities</SelectItem>
          {PRIORITY_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={params.categoryId || ALL}
        onValueChange={(v) => onPatch({ categoryId: v === ALL ? "" : v, page: 1 })}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All categories</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={params.sortBy}
        onValueChange={(v) => onPatch({ sortBy: v as TaskListParams["sortBy"] })}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="createdAt">Created</SelectItem>
          <SelectItem value="dueDate">Due date</SelectItem>
          <SelectItem value="priority">Priority</SelectItem>
          <SelectItem value="title">Title</SelectItem>
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="icon"
        title={params.order === "asc" ? "Ascending" : "Descending"}
        onClick={() => onPatch({ order: params.order === "asc" ? "desc" : "asc" })}
      >
        {params.order === "asc" ? (
          <ArrowUp className="size-4" />
        ) : (
          <ArrowDown className="size-4" />
        )}
      </Button>
    </div>
  );
}
