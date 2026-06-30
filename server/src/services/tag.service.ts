import { prisma } from "../lib/prisma.js";

// Tags are a global, shared catalogue (no per-user ownership), exposed
// read-only. Catalogue rows are managed via seeding/DB, not the API.

export async function list() {
  return prisma.tag.findMany({ orderBy: { name: "asc" } });
}
