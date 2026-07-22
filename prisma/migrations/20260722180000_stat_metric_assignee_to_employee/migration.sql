-- StatMetric.assignedTo pivots from User → Employee. The HR roster
-- (/admin/onboarding) is the source of truth for who owns a metric;
-- User is just system-access. Employees without a linked User can
-- now own metrics too.
--
-- Existing rows: the assigned_to_id currently holds User.id values.
-- We rewrite them to the corresponding Employee.id (via
-- employees.user_id). Metrics owned by Users without an Employee
-- record become unassigned — the ownership signal is preserved
-- wherever an HR record exists and dropped where it doesn't.

-- DropForeignKey — old link to users
ALTER TABLE "stat_metrics" DROP CONSTRAINT "stat_metrics_assigned_to_id_fkey";

-- Rewrite values: User.id → Employee.id via employees.user_id.
-- Rows where no matching Employee exists get NULL from the subquery
-- (Postgres returns NULL when the subselect finds nothing), so
-- there's no separate cleanup pass.
UPDATE "stat_metrics"
SET "assigned_to_id" = (
  SELECT e.id
  FROM "employees" e
  WHERE e.user_id = "stat_metrics"."assigned_to_id"
  LIMIT 1
)
WHERE "assigned_to_id" IS NOT NULL;

-- AddForeignKey — new link to employees
ALTER TABLE "stat_metrics" ADD CONSTRAINT "stat_metrics_assigned_to_id_fkey"
  FOREIGN KEY ("assigned_to_id") REFERENCES "employees"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
