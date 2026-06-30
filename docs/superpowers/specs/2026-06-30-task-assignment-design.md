# Task Assignment — Design

Date: 2026-06-30
Status: Approved

## Goal

Let tasks be assigned to a user other than their owner, on both backend and
frontend. The `Task.assignedToId` column + `assignedTo` relation and its index
already exist in the Prisma schema but are unused — this wires them through the
application and UI. **No migration required.**

## Permission model

- **Owner or ADMIN** may set / change / clear a task's `assignedToId`.
- **Assignee** (a non-owner the task is assigned to) gets **view + update** on
  that task: it appears in their lists/detail and they may edit fields
  (status, title, description, priority, dueDate, category, tags, metadata).
  They may **not** reassign it (owner/admin only) and may **not** delete it
  (owner/admin only).
- Self-assignment is allowed.

## Backend

1. **Access scoping** (`src/utils/ownership.ts`): add `taskAccessScope(user)` →
   `{}` for ADMIN, `{ OR: [{ userId: id }, { assignedToId: id }] }` for USER.
   Used for read (`list`, `getById`) and the `update` existence check, combined
   via `AND: [taskAccessScope(user)]` so it never collides with the `search`
   `OR` clause. `remove` keeps the stricter `ownerScope` (owner/admin only).
   `ownerScope` is unchanged.

2. **Validators** (`src/validators/task.validator.ts`): add
   `assignedToId: z.uuid().nullable().optional()` to `createTaskSchema`
   (update inherits via `.partial()`); add `assignedToId: z.uuid().optional()`
   to `listTasksQuerySchema`.

3. **Service** (`src/services/task.service.ts`):
   - `assertAssigneeExists(id)` → 404 `ASSIGNEE_NOT_FOUND` for a missing user.
   - `create`: if `assignedToId` provided, verify the user exists; store it.
   - `update`: existence check uses `taskAccessScope`; if the payload carries
     `assignedToId` and the actor is neither owner nor ADMIN → 403 `FORBIDDEN`;
     otherwise verify (when non-null) and apply.
   - `taskInclude` gains `assignedTo: { select: { id, name, email } }`, so the
     serialized DTO carries an `assignedTo` object plus the `assignedToId` scalar.

4. **Cache** (`src/services/taskCache.ts`): a task now lives in both the owner's
   and the assignee's per-user namespace. `invalidateTasks` becomes variadic
   (`...userIds`), deduping non-null ids, bumping each per-user namespace + the
   global namespace. Call sites pass owner and assignee (and, on reassignment,
   the previous assignee).

5. **New endpoint** `GET /api/v1/users/assignable` → `{ users: [{ id, name,
   email }] }` for any authenticated user. Reorder `src/routes/user.routes.ts`:
   `authenticate` for all → `/assignable` (open) → `requireRole("ADMIN")` →
   existing admin routes. Add `assignableUserSelect` to `src/utils/userSelect.ts`,
   `listAssignable()` to the user service, and a controller handler.
   - Trade-off: exposes every user's id/name/email to any authenticated user —
     accepted as the cost of the assignee picker.

6. **Constants** (`src/constants/errors.ts`): add `ASSIGNEE_NOT_FOUND` code +
   message.

## Frontend

- `lib/types.ts`: add `assignedTo: Pick<User, "id"|"name"|"email"> | null` to
  `Task`; add `AssignableUser` type.
- `features/tasks/hooks.ts`: `useAssignableUsers()`; add
  `assignedToId?: string | null` to `TaskInput`; add `assignedToId` list filter.
- `features/tasks/TaskFormDialog.tsx`: Assignee dropdown (users + "Unassigned"),
  shown only when the current user is owner or ADMIN (`useAuth()`); sends
  `assignedToId` (or `null` to unassign).
- `features/tasks/TaskDetailDialog.tsx`: "Assignee" meta row.
- `features/tasks/TaskFilters.tsx`: "Assigned to me" quick filter (sets
  `assignedToId` to the current user id).
- `features/tasks/TaskTable.tsx`: show the assignee name.

## Tests

Extend `tests/tasks.test.ts`: owner assigns to B; B sees it in list/get; B
updates status (200); B tries to reassign (403); B tries to delete (404); an
unrelated user C can't see it (404); assign to a non-existent user (404
`ASSIGNEE_NOT_FOUND`); `GET /users/assignable` as a normal USER (200).
