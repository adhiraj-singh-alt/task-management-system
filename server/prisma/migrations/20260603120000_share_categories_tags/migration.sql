-- Make categories and tags a shared, global catalogue (no per-user ownership).
-- Drop the per-user FK + composite unique, drop the user_id column, and add a
-- global unique on name for each.

-- DropForeignKey
ALTER TABLE "categories" DROP CONSTRAINT "categories_user_id_fkey";
ALTER TABLE "tags" DROP CONSTRAINT "tags_user_id_fkey";

-- DropIndex
DROP INDEX "categories_user_id_name_key";
DROP INDEX "tags_user_id_name_key";

-- AlterTable
ALTER TABLE "categories" DROP COLUMN "user_id";
ALTER TABLE "tags" DROP COLUMN "user_id";

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");
