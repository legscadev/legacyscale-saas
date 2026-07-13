-- Drop the tiered SuperAdminRole (MASTER/SUPPORT/AUDITOR).
-- The tiering was cosmetic — every gate in the app checks the
-- User.isSuperAdmin boolean cache, none consult grant.role. In the
-- single-tier operator model there's no distinction to preserve,
-- so both the column and the enum type go.
--
-- Idempotent — safe to re-run.

ALTER TABLE "super_admin_grants"
  DROP COLUMN IF EXISTS "role";

DROP TYPE IF EXISTS "SuperAdminRole";
