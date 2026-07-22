-- AlterTable: mark a status as the tenant's "Recurring" template column.
ALTER TABLE "task_statuses" ADD COLUMN "is_recurring" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: clones spawned from a Recurring status carry the source
-- task's id so changeStatus can auto-archive them on terminal
-- transitions. SetNull on the source's delete so the clone survives.
ALTER TABLE "tasks" ADD COLUMN "source_recurring_task_id" TEXT;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_source_recurring_task_id_fkey"
  FOREIGN KEY ("source_recurring_task_id") REFERENCES "tasks"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
