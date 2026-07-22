-- Reverses the column-based recurring design (20260721221919) and
-- moves the recurrence signal onto Task itself. Any tasks currently
-- parked in a Recurring status get reassigned to the tenant's first
-- non-recurring status so the FK stays valid after the drop.

-- Reassign tasks living in a recurring status to the tenant's first
-- non-recurring status by order_index. Skip tenants that (somehow)
-- have no non-recurring status — those blow up on the next step,
-- which is the correct signal.
UPDATE "tasks" t
SET "status_id" = ns.id
FROM (
  SELECT DISTINCT ON (company_id) company_id, id
  FROM "task_statuses"
  WHERE "is_recurring" = false
  ORDER BY company_id, "order_index" ASC
) ns
WHERE ns.company_id = t.company_id
  AND t."status_id" IN (
    SELECT id FROM "task_statuses" WHERE "is_recurring" = true
  );

-- Remove the recurring status rows themselves.
DELETE FROM "task_statuses" WHERE "is_recurring" = true;

-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_source_recurring_task_id_fkey";

-- Drop the now-obsolete columns.
ALTER TABLE "task_statuses" DROP COLUMN "is_recurring";
ALTER TABLE "tasks" DROP COLUMN "source_recurring_task_id";

-- Task-level flag. Default false so existing rows stay non-recurring.
ALTER TABLE "tasks" ADD COLUMN "is_recurring" BOOLEAN NOT NULL DEFAULT false;
