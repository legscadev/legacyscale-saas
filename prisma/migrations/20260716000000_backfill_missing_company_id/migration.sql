-- Backfill company_id on tables the tenancy foundation migration
-- expected to CREATE but that already existed on some databases from
-- an earlier `db push`. When the CREATE TABLE failed as "already
-- exists" during migrate deploy, the column embedded in the CREATE
-- was never added, so tenancy-scoped Prisma queries against these
-- tables raise "column company_id does not exist" at runtime.
--
-- Affects prod as of 2026-07-15 — recovered manually then, captured
-- here so any fresh database rolled forward from a partial-migration
-- state gets the same fix.
--
-- Every statement is idempotent (IF NOT EXISTS). Existing rows on
-- these tables get the Kondense seed id as the default company —
-- matches the intent of the failed CREATE TABLE, so pre-tenancy
-- content stays visible to the platform tenant.

ALTER TABLE "certificate_issuances"
  ADD COLUMN IF NOT EXISTS "company_id" TEXT NOT NULL
  DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS "certificate_issuances_company_id_idx"
  ON "certificate_issuances" ("company_id");

ALTER TABLE "nudges"
  ADD COLUMN IF NOT EXISTS "company_id" TEXT NOT NULL
  DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS "nudges_company_id_idx"
  ON "nudges" ("company_id");

ALTER TABLE "stat_divisions"
  ADD COLUMN IF NOT EXISTS "company_id" TEXT NOT NULL
  DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS "stat_divisions_company_id_idx"
  ON "stat_divisions" ("company_id");

ALTER TABLE "stat_metrics"
  ADD COLUMN IF NOT EXISTS "company_id" TEXT NOT NULL
  DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS "stat_metrics_company_id_idx"
  ON "stat_metrics" ("company_id");

ALTER TABLE "stat_data_points"
  ADD COLUMN IF NOT EXISTS "company_id" TEXT NOT NULL
  DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS "stat_data_points_company_id_idx"
  ON "stat_data_points" ("company_id");
