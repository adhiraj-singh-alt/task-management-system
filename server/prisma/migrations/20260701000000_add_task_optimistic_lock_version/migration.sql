-- Optimistic-locking counter on tasks. Existing rows default to 0; every
-- accepted update bumps it so a stale write (client version != current) is
-- rejected with a 409 in the service layer.
-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;
