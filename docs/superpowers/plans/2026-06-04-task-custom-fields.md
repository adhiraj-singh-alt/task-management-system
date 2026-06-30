# Task Custom Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users attach ad-hoc custom fields (key/value pairs) to a task, edited in the task form and shown read-only in the task detail view, stored in the existing `Task.metadata` JSONB column.

**Architecture:** Entirely frontend. The backend already accepts `metadata` on create/update and returns it on every task. We add a local-state key/value editor to `TaskFormDialog`, thread `metadata` through the `TaskInput` payload type, and render saved fields read-only in `TaskDetailDialog`. No backend, schema, migration, or API changes.

**Tech Stack:** React 19, TypeScript, react-hook-form (existing form fields), local `useState` (dynamic metadata rows), shadcn/ui (`Input`, `Button`, `Label`), lucide-react icons.

**Verification convention:** This repo is **not** a git repository and the client has **no test harness wired up** (vitest is installed but unconfigured, zero test files). Per the project's existing convention, each task is verified with **typecheck + lint**, and the feature is verified end-to-end with a **manual click-through**. There are no commit steps.

Commands (run from repo root `/home/netzwelt/Desktop/code/2026-DSIE/capstone`):
- Typecheck: `pnpm -C client exec tsc -b`
- Lint: `pnpm -C client lint`
- Dev server (manual check): `pnpm -C client dev`

---

## File structure

- `client/src/features/tasks/hooks.ts` — **Modify.** Add `metadata` to the `TaskInput` payload type. (Responsibility: API payload shapes + task data hooks.)
- `client/src/features/tasks/TaskFormDialog.tsx` — **Modify.** Add the custom-fields editor: local state, seeding on open, add/update/remove row handlers, the UI section, and metadata assembly in `onSubmit`. (Responsibility: the create/edit task form.)
- `client/src/features/tasks/TaskDetailDialog.tsx` — **Modify.** Render saved metadata read-only as `MetaRow`s. (Responsibility: the read-only task detail view.)

---

## Task 1: Thread `metadata` through the payload type

**Files:**
- Modify: `client/src/features/tasks/hooks.ts` (the `TaskInput` interface, around lines 72–82)

- [ ] **Step 1: Add `metadata` to `TaskInput`**

In `client/src/features/tasks/hooks.ts`, replace the `TaskInput` interface:

```ts
/** Payload for create/update. Omit a field to leave it unset/unchanged. */
export interface TaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  categoryId?: string;
  tagIds?: string[];
  parentId?: string | null; // uuid to nest under a parent; null to detach.
  metadata?: Record<string, string>; // ad-hoc custom fields stored as JSONB on the task.
}
```

No other change is needed here: `useCreateTask` / `useUpdateTask` already POST/PATCH the whole `TaskInput` object, so `metadata` flows through untouched.

- [ ] **Step 2: Typecheck**

Run: `pnpm -C client exec tsc -b`
Expected: PASS (no errors). The new optional field does not break existing callers.

- [ ] **Step 3: Lint**

Run: `pnpm -C client lint`
Expected: PASS (no new warnings/errors).

---

## Task 2: Custom-fields editor in `TaskFormDialog`

**Files:**
- Modify: `client/src/features/tasks/TaskFormDialog.tsx`

This task touches four spots in the file: imports, state declaration, the `open` effect (seeding), the `onSubmit` assembly, and the JSX (new section before the footer), plus three small handlers.

- [ ] **Step 1: Add the icon import**

At the top of `client/src/features/tasks/TaskFormDialog.tsx`, add a lucide-react import (the file does not currently import from it):

```ts
import { Plus, Trash2 } from "lucide-react";
```

Place it with the other top-level imports (e.g. just below the `react-hook-form` / `zod` imports, before the local `@/lib` imports).

- [ ] **Step 2: Add the fields state**

Just below the existing `const [selectedTags, setSelectedTags] = useState<string[]>([]);` line, add:

```ts
// Ad-hoc custom fields, persisted to task.metadata. Kept as ordered rows
// (not react-hook-form) because the keys themselves are user-defined.
const [fields, setFields] = useState<{ key: string; value: string }[]>([]);
```

- [ ] **Step 3: Add the row handlers**

Below the `fields` state (still inside the component, near the other handlers like `toggleTag`), add:

```ts
const addField = () => setFields((prev) => [...prev, { key: "", value: "" }]);

const updateField = (index: number, patch: Partial<{ key: string; value: string }>) =>
  setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));

const removeField = (index: number) =>
  setFields((prev) => prev.filter((_, i) => i !== index));
```

- [ ] **Step 4: Seed `fields` when the dialog opens**

In the existing `useEffect` that runs on `open` (the one ending with `setSelectedTags(task?.tags.map((t) => t.id) ?? []);`), add a `setFields(...)` call right after the `setSelectedTags` line:

```ts
setSelectedTags(task?.tags.map((t) => t.id) ?? []);
setFields(
  task?.metadata
    ? Object.entries(task.metadata).map(([key, value]) => ({
        key,
        value: String(value),
      }))
    : [],
);
```

- [ ] **Step 5: Assemble `metadata` in `onSubmit`**

In `onSubmit`, after the existing `if (!hasChildren) input.parentId = ...;` line and before the `try {`, add:

```ts
// Trim keys, drop empty-key rows, last write wins on duplicate keys.
const metadata = fields.reduce<Record<string, string>>((acc, { key, value }) => {
  const k = key.trim();
  if (k) acc[k] = value;
  return acc;
}, {});
// Create: only send if non-empty. Edit: always send (even {}) so cleared
// fields are removed — the backend replaces metadata wholesale.
if (isEdit || Object.keys(metadata).length > 0) input.metadata = metadata;
```

(`isEdit` is already defined near the top of the component as `const isEdit = Boolean(task);`.)

- [ ] **Step 6: Add the editor UI section**

In the JSX, insert this block **after** the closing `)}` of the `tags.length > 0 && (...)` section and **before** `<DialogFooter>`:

```tsx
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
```

Note: rows are keyed by `index` deliberately — the rows are reorderable only by add/remove at the end and have no stable id, and `index` keeps focus stable while typing into a row.

- [ ] **Step 7: Typecheck**

Run: `pnpm -C client exec tsc -b`
Expected: PASS. Confirms `Button`'s `size="icon"`/`size="sm"` and `variant="ghost"` props exist (they are standard shadcn button variants — if the local `button.tsx` lacks `ghost` or `icon`, the typecheck will flag it; in that case use `variant="outline"` and drop `size`).

- [ ] **Step 8: Lint**

Run: `pnpm -C client lint`
Expected: PASS.

---

## Task 3: Read-only display in `TaskDetailDialog`

**Files:**
- Modify: `client/src/features/tasks/TaskDetailDialog.tsx`

- [ ] **Step 1: Render saved metadata as `MetaRow`s**

In `client/src/features/tasks/TaskDetailDialog.tsx`, inside the `{/* Meta */}` block, **after** the closing `</MetaRow>` of the Tags row and **before** the closing `</div>` of that `space-y-2` group, add:

```tsx
{Object.keys(task.metadata).length > 0 &&
  Object.entries(task.metadata).map(([key, value]) => (
    <MetaRow key={key} label={key}>
      <span className="break-words">{String(value)}</span>
    </MetaRow>
  ))}
```

This reuses the existing `MetaRow` component (defined at the top of the file), so custom fields render in the same label/value grid as Due, Category, and Tags. The block renders nothing when the task has no metadata. `String(value)` is defensive — `task.metadata` is typed `Record<string, unknown>` even though the form only ever writes strings.

- [ ] **Step 2: Typecheck**

Run: `pnpm -C client exec tsc -b`
Expected: PASS.

- [ ] **Step 3: Lint**

Run: `pnpm -C client lint`
Expected: PASS.

---

## Task 4: Manual end-to-end verification

**Files:** none (manual check).

- [ ] **Step 1: Start the backend and frontend**

Start the API (from repo root): `pnpm -C server dev` (needs Postgres up).
Start the client: `pnpm -C client dev`, then open the printed local URL and log in.

- [ ] **Step 2: Create a task with custom fields**

Open "New task". Fill in a title. Under **Custom fields**, click **Add field** twice. Enter e.g. `Estimate` / `3 days` and `Client` / `Acme`. Save.
Expected: task saves with no error; toast "Task created".

- [ ] **Step 3: Verify they show in the detail view**

Open the new task's detail dialog.
Expected: an `Estimate` row showing `3 days` and a `Client` row showing `Acme`, in the meta grid below Tags.

- [ ] **Step 4: Edit — change, add, and remove fields**

Click Edit. Confirm both fields are pre-filled. Change `3 days` → `5 days`, add a third field `Owner` / `Jess`, and remove the `Client` row with the trash button. Save.
Expected: detail view now shows `Estimate: 5 days` and `Owner: Jess`, and no `Client` row.

- [ ] **Step 5: Remove all fields**

Edit the task again, remove every custom-field row, and save.
Expected: detail view shows no custom-field rows (the block disappears); Due/Category/Tags still render normally.

- [ ] **Step 6: Empty-key safety**

Edit a task, add a field with a **blank field name** but a value, and save.
Expected: the blank-key row is silently dropped — it does not appear in the detail view.

---

## Self-review notes

- **Spec coverage:** Data-flow/`TaskInput` (Task 1) ✓; editor with add/seed/submit/edge-cases (Task 2) ✓; read-only detail display (Task 3) ✓; create-vs-update send semantics (Task 2 Step 5) ✓; empty-key/duplicate-key handling (Task 2 Step 5, verified Task 4 Step 6) ✓. No backend changes required (spec confirms) ✓.
- **Type consistency:** `metadata` is `Record<string, string>` on the `TaskInput` payload (Task 1); the editor builds exactly that shape (Task 2 Step 5); the detail view reads `task.metadata` typed `Record<string, unknown>` and stringifies defensively (Task 3). `fields` row shape `{ key: string; value: string }` is identical across state, handlers, seeding, and submit.
- **No placeholders:** every code step contains complete code; commands have expected output.
- **Fallback flagged:** Task 2 Step 7 notes the one external assumption (shadcn `Button` `ghost`/`icon`/`sm` variants) and gives the fallback if the local component lacks them.
