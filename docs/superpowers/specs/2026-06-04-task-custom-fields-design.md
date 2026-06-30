# Ad-hoc custom fields on tasks — design

**Date:** 2026-06-04
**Status:** Approved

## Summary

Let users attach arbitrary custom fields to a task as ad-hoc key/value pairs,
stored in the existing `Task.metadata` JSONB column. Users add/edit/remove rows
in the task form; saved fields are shown read-only in the task detail view.

This is **entirely a frontend feature**. The backend already supports it:

- `Task.metadata` is a GIN-indexed JSONB column (`prisma/schema.prisma`).
- `createTaskSchema` / `updateTaskSchema` already accept
  `metadata: z.record(z.string(), z.unknown()).optional()`
  (`server/src/validators/task.validator.ts`).
- The frontend `Task` type already carries `metadata: Record<string, unknown>`
  (`client/src/lib/types.ts`).

No backend, schema, migration, or API changes.

## Decisions

- **Field model:** ad-hoc key/value per task. No shared/predefined field
  catalogue. Different tasks may have entirely different keys.
- **Value type:** plain text only. No typed (number/date/boolean) values.
- **Display scope:** editable in the task form **and** shown read-only in the
  task detail dialog.

## Files changed (client only)

1. `client/src/features/tasks/hooks.ts`
2. `client/src/features/tasks/TaskFormDialog.tsx`
3. `client/src/features/tasks/TaskDetailDialog.tsx`

## 1. Data flow — `hooks.ts`

Add `metadata` to the `TaskInput` payload type:

```ts
export interface TaskInput {
  // ...existing fields...
  metadata?: Record<string, string>;
}
```

The `useCreateTask` / `useUpdateTask` mutations already POST/PATCH the whole
`TaskInput` object, so `metadata` flows through with no further change.

On the wire: `metadata: { "Estimate": "3 days", "Client": "Acme" }`.

## 2. Editor — `TaskFormDialog.tsx`

A new "Custom fields" section rendered above the dialog footer.

Modeled as **local component state**, mirroring the existing `selectedTags`
pattern (not react-hook-form, because the keys themselves are dynamic):

```ts
const [fields, setFields] = useState<{ key: string; value: string }[]>([]);
```

UI:

- Each row = two `Input`s (field name, value) + a remove (trash) icon button.
- An **"Add field"** button appends a blank `{ key: "", value: "" }` row.
- Rendered in the same `space-y` rhythm as the other form sections.

Seeding (in the existing `useEffect` that runs on `open`):

- Seed `fields` from `task.metadata`:
  `Object.entries(task.metadata).map(([key, value]) => ({ key, value: String(value) }))`.
- Empty array for create (or when a task has no metadata).

Submit (`onSubmit`), reduce rows → object:

- Trim each key.
- **Drop rows whose trimmed key is empty.**
- On duplicate keys, **last row wins**.

```ts
const metadata = fields.reduce<Record<string, string>>((acc, { key, value }) => {
  const k = key.trim();
  if (k) acc[k] = value;
  return acc;
}, {});
```

- **Create:** include `metadata` in the input only if it has at least one key.
- **Update:** always include `metadata` (even `{}`), so removing all fields
  actually clears them — the backend replaces `metadata` wholesale.

## 3. Read-only display — `TaskDetailDialog.tsx`

In the existing Meta section, after the Tags row, render saved custom fields.

- Render the block only when `Object.keys(task.metadata).length > 0`.
- One `MetaRow` per field, reusing the existing `MetaRow` component, with the
  field key as the row label and the value as text:

```tsx
{Object.entries(task.metadata).map(([key, value]) => (
  <MetaRow key={key} label={key}>
    {String(value)}
  </MetaRow>
))}
```

## Edge cases

- Empty / whitespace-only keys are trimmed and ignored on save.
- Duplicate keys: last row wins (silent — acceptable for an ad-hoc list).
- Editing a task with no metadata → empty editor.
- Removing all fields on an existing task → sends `{}`, clearing them.
- Detail view stringifies values defensively (`String(value)`) since the type
  is `Record<string, unknown>`, even though we only ever write strings.

## Out of scope (YAGNI)

- Typed values (number/date/boolean/select).
- Predefined / shared field definitions or an admin catalogue.
- Filtering, sorting, or reporting on metadata.
- Key-uniqueness warnings in the UI.
