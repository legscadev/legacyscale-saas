-- ============================================================
-- Phase 4.4.1 — SuperAdminGrant table
-- ============================================================
-- Replaces the User.isSuperAdmin boolean with a proper table so
-- we get:
--   * audit trail — every grant/revoke is a row that stays
--   * tiered roles — MASTER / SUPPORT / AUDITOR
--   * expiration — grants can auto-lapse
--   * granted-by / revoked-by attribution
--
-- The boolean column on users stays for now as a hot-path cache;
-- every grant/revoke also flips it. Phase 7 drops the column once
-- every reader has moved off it.
--
-- Dev-only: this migration runs against dbkondenseai_dev. Prod
-- stays on the boolean until we explicitly promote.
-- ============================================================

CREATE TYPE "SuperAdminRole" AS ENUM ('MASTER', 'SUPPORT', 'AUDITOR');

CREATE TABLE public.super_admin_grants (
  id              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id         text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role            "SuperAdminRole" NOT NULL DEFAULT 'MASTER',
  granted_by_id   text REFERENCES public.users(id) ON DELETE SET NULL,
  granted_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz,
  revoked_at      timestamptz,
  revoked_by_id   text REFERENCES public.users(id) ON DELETE SET NULL,
  notes           text
);

-- Hot-path index — "does this user have an active grant?"
CREATE INDEX super_admin_grants_user_id_revoked_at_idx
  ON public.super_admin_grants (user_id, revoked_at);

CREATE INDEX super_admin_grants_expires_at_idx
  ON public.super_admin_grants (expires_at)
  WHERE expires_at IS NOT NULL;

-- Partial unique: at most one row per user where revoked_at IS NULL.
-- Prisma doesn't emit partial uniques from schema.prisma, so we
-- add it here in raw SQL. Every re-grant after a revoke gets a
-- fresh row.
CREATE UNIQUE INDEX super_admin_grants_one_active_per_user
  ON public.super_admin_grants (user_id)
  WHERE revoked_at IS NULL;

-- Backfill from the existing boolean column. Every user with
-- is_super_admin = true gets one active MASTER grant. granted_by
-- is left null (system seed) and grantedAt uses createdAt so
-- history stays roughly accurate.
INSERT INTO public.super_admin_grants (user_id, role, granted_by_id, granted_at, notes)
SELECT id, 'MASTER'::"SuperAdminRole", NULL, created_at,
       'Backfilled from User.isSuperAdmin during Phase 4.4 migration.'
FROM public.users
WHERE is_super_admin = true;

-- Sanity check: every super-admin got backfilled.
DO $$
DECLARE
  boolean_count int;
  grant_count int;
BEGIN
  SELECT count(*) INTO boolean_count FROM public.users WHERE is_super_admin = true;
  SELECT count(*) INTO grant_count FROM public.super_admin_grants WHERE revoked_at IS NULL AND role = 'MASTER';
  IF boolean_count <> grant_count THEN
    RAISE EXCEPTION 'Backfill mismatch: % super-admins in users, % active MASTER grants',
      boolean_count, grant_count;
  END IF;
  RAISE NOTICE 'Backfill sanity check OK — % super-admins → % active grants', boolean_count, grant_count;
END $$;
