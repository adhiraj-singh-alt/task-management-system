import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../generated/prisma/client.js";
import { hashPassword } from "../src/utils/password.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Local string-union aliases that match the Prisma enums (string-union under the
// hood) so the declarative seed data below stays self-contained and readable.
type Role = "USER" | "ADMIN";
type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED";
type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

interface SeedSubtask {
  title: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  completedAt?: string;
  tags?: string[];
  metadata?: Prisma.InputJsonValue;
}

interface SeedTask extends SeedSubtask {
  /** Category name (must exist in the user's `categories`); omit for none. */
  category?: string;
  description?: string;
  /** Assign the task to the owning user (the only assignee in a single-user seed). */
  assignToSelf?: boolean;
  subtasks?: SeedSubtask[];
}

interface SeedUserInput {
  email: string;
  name: string;
  role: Role;
  password: string;
  tasks: SeedTask[];
}

// Resolve a category/tag name to its global id (categories and tags are a
// single shared catalogue across all users). Populated once in `main`.
const categoryId = new Map<string, string>();
const tagId = new Map<string, string>();

const tagConnect = (names?: string[]) =>
  names && names.length > 0
    ? { create: names.map((n) => ({ tagId: tagId.get(n)! })) }
    : undefined;

/**
 * Create one user with their tasks (incl. nested subtasks). Categories and tags
 * are global/shared — tasks reference them by name via the maps above.
 */
async function seedUser(input: SeedUserInput): Promise<{ tasks: number; subtasks: number }> {
  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
      role: input.role,
    },
  });

  let tasks = 0;
  let subtasks = 0;
  for (const t of input.tasks) {
    const parentCategoryId = t.category ? (categoryId.get(t.category) ?? null) : null;
    const parent = await prisma.task.create({
      data: {
        userId: user.id,
        categoryId: parentCategoryId,
        assignedToId: t.assignToSelf ? user.id : null,
        title: t.title,
        description: t.description ?? null,
        status: t.status ?? "TODO",
        priority: t.priority ?? "MEDIUM",
        dueDate: t.dueDate ? new Date(t.dueDate) : null,
        completedAt: t.completedAt ? new Date(t.completedAt) : null,
        metadata: t.metadata ?? {},
        tags: tagConnect(t.tags),
      },
    });
    tasks++;

    for (const s of t.subtasks ?? []) {
      await prisma.task.create({
        data: {
          userId: user.id,
          parentId: parent.id,
          // Subtasks inherit the parent's category unless they name their own.
          categoryId: parentCategoryId,
          title: s.title,
          status: s.status ?? "TODO",
          priority: s.priority ?? "MEDIUM",
          dueDate: s.dueDate ? new Date(s.dueDate) : null,
          completedAt: s.completedAt ? new Date(s.completedAt) : null,
          metadata: s.metadata ?? {},
          tags: tagConnect(s.tags),
        },
      });
      tasks++;
      subtasks++;
    }
  }

  return { tasks, subtasks };
}

// Shared password for every seeded account (dev only).
const SEED_PASSWORD = "Test@123";

// A shared category/tag palette reused across the seeded users.
const CATEGORIES = [
  { name: "Work", color: "#3b82f6" },
  { name: "Personal", color: "#22c55e" },
  { name: "Errands", color: "#f59e0b" },
  { name: "Learning", color: "#8b5cf6" },
];
const TAGS = ["urgent", "home", "finance", "health", "research", "blocked"];

const USERS: SeedUserInput[] = [
  {
    email: "demo@taskflow.dev",
    name: "Demo User",
    role: "ADMIN",
    password: SEED_PASSWORD,
    tasks: [
      {
        title: "Write Q3 project proposal",
        category: "Work",
        description: "Draft and circulate the proposal for review.",
        status: "IN_PROGRESS",
        priority: "HIGH",
        dueDate: "2026-06-10T17:00:00Z",
        metadata: { estimateHours: 6, source: "client-request", reviewers: ["alice", "bob"] },
        tags: ["urgent", "finance"],
        subtasks: [
          {
            title: "Draft proposal outline",
            status: "DONE",
            priority: "MEDIUM",
            completedAt: "2026-06-01T10:00:00Z",
          },
          { title: "Gather budget figures", status: "IN_PROGRESS", priority: "HIGH", tags: ["finance"] },
          { title: "Circulate proposal for review", status: "TODO", priority: "MEDIUM" },
        ],
      },
      {
        title: "Fix login redirect bug",
        category: "Work",
        description: "Users land on the wrong page after SSO login.",
        status: "TODO",
        priority: "URGENT",
        dueDate: "2026-06-03T12:00:00Z",
        assignToSelf: true,
        metadata: { ticket: "TF-142", severity: "high" },
        tags: ["urgent"],
        subtasks: [
          { title: "Reproduce the redirect", status: "DONE", priority: "HIGH", completedAt: "2026-06-02T09:00:00Z" },
          { title: "Patch the callback handler", status: "TODO", priority: "URGENT", tags: ["blocked"] },
        ],
      },
      {
        title: "Quarterly hiring plan",
        category: "Work",
        description: "Headcount and role priorities for Q3.",
        status: "IN_PROGRESS",
        priority: "MEDIUM",
        dueDate: "2026-06-20T17:00:00Z",
        metadata: { openRoles: 3 },
        tags: ["research"],
        subtasks: [
          { title: "Draft job descriptions", status: "TODO", priority: "MEDIUM" },
          { title: "Align with finance on budget", status: "TODO", priority: "MEDIUM", tags: ["finance"] },
        ],
      },
      {
        title: "Book dentist appointment",
        category: "Personal",
        status: "TODO",
        priority: "MEDIUM",
        tags: ["health"],
      },
      {
        title: "Plan weekend hike",
        category: "Personal",
        description: "Pick a trail and check the weather.",
        status: "TODO",
        priority: "LOW",
        dueDate: "2026-06-13T08:00:00Z",
        tags: ["health", "home"],
      },
      {
        title: "Buy groceries",
        category: "Errands",
        description: "Weekly shop.",
        status: "DONE",
        priority: "LOW",
        completedAt: "2026-05-30T18:30:00Z",
        metadata: { items: ["milk", "eggs", "bread"], store: "local" },
        tags: ["home"],
      },
      {
        title: "Renew car insurance",
        category: "Personal",
        status: "ARCHIVED",
        priority: "MEDIUM",
        metadata: { provider: "Acme", policyNo: "AC-99812" },
        tags: ["finance", "home"],
      },
      {
        title: "Read 'Designing Data-Intensive Applications'",
        category: "Learning",
        status: "IN_PROGRESS",
        priority: "LOW",
        metadata: { progressPct: 35 },
        tags: ["research"],
        subtasks: [
          { title: "Finish Part I (Foundations)", status: "DONE", priority: "LOW", completedAt: "2026-05-28T20:00:00Z" },
          { title: "Take notes on replication", status: "TODO", priority: "LOW" },
        ],
      },
      {
        title: "Submit expense report",
        category: "Work",
        status: "DONE",
        priority: "MEDIUM",
        completedAt: "2026-05-29T14:00:00Z",
        metadata: { amount: 248.5, currency: "USD" },
        tags: ["finance"],
      },
    ],
  },
  {
    email: "adhiraj.singh@vtnetzwelt.com",
    name: "Adhiraj Singh",
    role: "ADMIN",
    password: SEED_PASSWORD,
    tasks: [
      {
        title: "Lead sprint planning",
        category: "Work",
        description: "Groom the backlog and set sprint goals.",
        status: "IN_PROGRESS",
        priority: "HIGH",
        dueDate: "2026-06-05T09:30:00Z",
        assignToSelf: true,
        metadata: { sprint: 24, team: "platform" },
        tags: ["urgent"],
        subtasks: [
          { title: "Refine top backlog items", status: "DONE", priority: "MEDIUM", completedAt: "2026-06-02T11:00:00Z" },
          { title: "Estimate capacity", status: "IN_PROGRESS", priority: "MEDIUM" },
          { title: "Publish sprint board", status: "TODO", priority: "MEDIUM" },
        ],
      },
      {
        title: "Migrate API to Prisma 7",
        category: "Work",
        description: "Upgrade the driver adapter and regenerate the client.",
        status: "IN_PROGRESS",
        priority: "URGENT",
        dueDate: "2026-06-08T17:00:00Z",
        metadata: { ticket: "TF-201", risk: "medium" },
        tags: ["urgent", "research"],
        subtasks: [
          { title: "Audit raw SQL for breaking changes", status: "DONE", priority: "HIGH", completedAt: "2026-06-01T16:00:00Z" },
          { title: "Update migration pipeline", status: "TODO", priority: "HIGH", tags: ["blocked"] },
        ],
      },
      {
        title: "Review security findings",
        category: "Work",
        status: "TODO",
        priority: "HIGH",
        dueDate: "2026-06-06T17:00:00Z",
        metadata: { severity: "high", findings: 4 },
        tags: ["urgent"],
      },
      {
        title: "1:1s with the team",
        category: "Work",
        status: "TODO",
        priority: "MEDIUM",
        dueDate: "2026-06-04T15:00:00Z",
        subtasks: [
          { title: "Prep talking points", status: "TODO", priority: "LOW" },
        ],
      },
      {
        title: "Renew domain & SSL certs",
        category: "Errands",
        status: "TODO",
        priority: "MEDIUM",
        dueDate: "2026-06-18T00:00:00Z",
        metadata: { provider: "namecheap", autoRenew: false },
        tags: ["finance", "home"],
      },
      {
        title: "Gym session",
        category: "Personal",
        status: "DONE",
        priority: "LOW",
        completedAt: "2026-06-02T07:00:00Z",
        tags: ["health"],
      },
      {
        title: "Study Kubernetes operators",
        category: "Learning",
        status: "IN_PROGRESS",
        priority: "LOW",
        metadata: { progressPct: 20 },
        tags: ["research"],
        subtasks: [
          { title: "Build a sample controller", status: "TODO", priority: "LOW" },
        ],
      },
      {
        title: "File Q2 taxes",
        category: "Personal",
        status: "ARCHIVED",
        priority: "MEDIUM",
        metadata: { year: 2026, quarter: 2 },
        tags: ["finance"],
      },
    ],
  },
  {
    email: "user1@email.com",
    name: "User One",
    role: "USER",
    password: SEED_PASSWORD,
    tasks: [
      {
        title: "Onboarding checklist",
        category: "Work",
        description: "Get set up on all the team tools.",
        status: "IN_PROGRESS",
        priority: "HIGH",
        dueDate: "2026-06-07T17:00:00Z",
        assignToSelf: true,
        metadata: { progressPct: 50 },
        tags: ["urgent"],
        subtasks: [
          { title: "Set up dev environment", status: "DONE", priority: "HIGH", completedAt: "2026-06-02T12:00:00Z" },
          { title: "Read the architecture docs", status: "IN_PROGRESS", priority: "MEDIUM", tags: ["research"] },
          { title: "Pair on first ticket", status: "TODO", priority: "MEDIUM" },
        ],
      },
      {
        title: "Write unit tests for cart module",
        category: "Work",
        status: "TODO",
        priority: "MEDIUM",
        dueDate: "2026-06-12T17:00:00Z",
        metadata: { coverageTarget: 0.8 },
      },
      {
        title: "Meal prep for the week",
        category: "Personal",
        status: "TODO",
        priority: "LOW",
        tags: ["health", "home"],
      },
      {
        title: "Return library books",
        category: "Errands",
        status: "DONE",
        priority: "LOW",
        completedAt: "2026-05-31T11:00:00Z",
      },
      {
        title: "Fix flaky checkout test",
        category: "Work",
        description: "Intermittent timeout in CI.",
        status: "TODO",
        priority: "HIGH",
        metadata: { ticket: "TF-188" },
        tags: ["urgent"],
        subtasks: [
          { title: "Add retry + logging", status: "TODO", priority: "MEDIUM" },
        ],
      },
      {
        title: "Schedule eye exam",
        category: "Personal",
        status: "ARCHIVED",
        priority: "LOW",
        tags: ["health"],
      },
    ],
  },
  {
    email: "user2@email.com",
    name: "User Two",
    role: "USER",
    password: SEED_PASSWORD,
    tasks: [
      {
        title: "Prepare client demo",
        category: "Work",
        description: "Walk through the new dashboard.",
        status: "IN_PROGRESS",
        priority: "URGENT",
        dueDate: "2026-06-04T13:00:00Z",
        assignToSelf: true,
        metadata: { client: "Globex", attendees: 5 },
        tags: ["urgent"],
        subtasks: [
          { title: "Build slide deck", status: "DONE", priority: "HIGH", completedAt: "2026-06-02T18:00:00Z" },
          { title: "Rehearse walkthrough", status: "IN_PROGRESS", priority: "HIGH" },
          { title: "Send calendar invite", status: "TODO", priority: "MEDIUM" },
        ],
      },
      {
        title: "Refactor reports query",
        category: "Work",
        status: "TODO",
        priority: "MEDIUM",
        metadata: { ticket: "TF-176" },
        tags: ["research"],
        subtasks: [
          { title: "Benchmark current query", status: "TODO", priority: "LOW" },
        ],
      },
      {
        title: "Pay credit card bill",
        category: "Errands",
        status: "TODO",
        priority: "HIGH",
        dueDate: "2026-06-09T00:00:00Z",
        metadata: { amount: 540.0, currency: "USD" },
        tags: ["finance"],
      },
      {
        title: "Clean the garage",
        category: "Personal",
        status: "TODO",
        priority: "LOW",
        tags: ["home"],
      },
      {
        title: "Update résumé",
        category: "Personal",
        status: "DONE",
        priority: "LOW",
        completedAt: "2026-05-27T20:00:00Z",
      },
      {
        title: "Research vacation destinations",
        category: "Personal",
        status: "ARCHIVED",
        priority: "LOW",
        metadata: { budget: 2000, candidates: ["Lisbon", "Kyoto"] },
        tags: ["research"],
      },
    ],
  },
];

/**
 * Seed the shared, global category & tag catalogue (the same rows for every
 * user) and populate the name→id lookup maps. Idempotent via upsert on the
 * unique `name`, so re-running the seed preserves existing ids.
 */
async function seedCatalogue(): Promise<void> {
  for (const c of CATEGORIES) {
    const cat = await prisma.category.upsert({
      where: { name: c.name },
      update: { color: c.color },
      create: { name: c.name, color: c.color },
    });
    categoryId.set(c.name, cat.id);
  }
  for (const name of TAGS) {
    const tag = await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    tagId.set(name, tag.id);
  }
}

async function main(): Promise<void> {
  const emails = USERS.map((u) => u.email);

  // Idempotent: wipe the seeded users (cascades to their tasks) and rebuild.
  await prisma.user.deleteMany({ where: { email: { in: emails } } });

  // Categories and tags are global/shared — seed them once, before the users.
  await seedCatalogue();
  console.log(`🌱 Seeded shared catalogue — ${CATEGORIES.length} categories, ${TAGS.length} tags.`);

  let totalTasks = 0;
  let totalSubtasks = 0;
  for (const u of USERS) {
    const { tasks, subtasks } = await seedUser(u);
    totalTasks += tasks;
    totalSubtasks += subtasks;
    console.log(`🌱 Seeded ${u.email} (${u.role}) — ${tasks} tasks (${subtasks} subtasks).`);
  }

  console.log(
    `✅ Seeded ${USERS.length} users with ${totalTasks} tasks total (${totalSubtasks} subtasks).`,
  );
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
