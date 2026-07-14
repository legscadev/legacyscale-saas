-- ============================================================
-- LEGACY SCALE — TENANCY RLS POLICIES
-- ============================================================
-- Adds company-scoped RLS on every tenant-scoped table. Each
-- policy passes through when `app.company_id` is unset — that keeps
-- the current app path (which does NOT set the session variable
-- yet) unaffected. It is designed to become the primary defense
-- once we retire the Prisma role's BYPASSRLS attribute (post-2.7).
--
-- Safe to re-run: every policy is dropped before it is recreated.
-- The `pass-through` fallback means enabling RLS on these tables
-- does not break Ruby's existing pre-tenancy queries.
--
-- Set app.company_id per request via lib/tenancy/tenant-context.ts.
-- ============================================================

-- Helper: current tenant read from the session variable, NULL when
-- unset. `true` on missing_ok returns NULL instead of erroring.
-- Returns text — the underlying company_id columns are text (see
-- Phase 1 migration) so we avoid pointless casts on every row.
DROP FUNCTION IF EXISTS public.current_company_id() CASCADE;
CREATE FUNCTION public.current_company_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.company_id', true), '')
$$;

-- Helper: does the session's authenticated user carry
-- is_super_admin = true? Uses the same auth_id → users.id resolution
-- as the existing base RLS. Returns false when unauthenticated so
-- non-Supabase paths never accidentally elevate.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.auth_id = auth.uid()::text
      AND u.is_super_admin = true
  )
$$;

-- ============================================================
-- Per-table policy generator — DRY macro.
-- ============================================================
-- For each scoped table we install two policies:
--   1. `<table>_tenant_read`  — SELECT
--   2. `<table>_tenant_write` — INSERT / UPDATE / DELETE
--
-- Both allow rows whose company_id matches the session var, OR fall
-- through when the session var is NULL (current app path), OR when
-- the caller is a super-admin.
-- ============================================================

DO $$
DECLARE
  scoped_table text;
  scoped_tables text[] := ARRAY[
    'invites',
    'courses',
    'categories',
    'course_categories',
    'modules',
    'chapters',
    'lessons',
    'lesson_resources',
    'quiz_questions',
    'quiz_attempts',
    'enrollments',
    'lesson_progress',
    'notes',
    'certificate_issuances',
    'announcements',
    'announcement_reads',
    'announcement_comments',
    'announcement_reactions',
    'announcement_audit_logs',
    'nudges',
    'stat_divisions',
    'stat_metrics',
    'stat_data_points',
    'org_board_revisions',
    'org_nodes',
    'position_details',
    'position_assignments',
    'org_node_audit_logs',
    'employees',
    'onboarding_checklist_items',
    'employee_checklist_item_statuses',
    'app_settings'
  ];
BEGIN
  FOREACH scoped_table IN ARRAY scoped_tables LOOP
    -- Enable RLS (idempotent, does not affect existing base policies)
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', scoped_table);

    -- Drop tenancy policies if present so this script is idempotent
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      scoped_table || '_tenant_read',
      scoped_table
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      scoped_table || '_tenant_write',
      scoped_table
    );

    -- RESTRICTIVE policies AND with every other policy on the same
    -- table (rather than OR like PERMISSIVE ones). Without this the
    -- base `courses_select_published` etc would widen access past
    -- the tenant fence. See postgres docs: RESTRICTIVE = tightener.
    --
    -- Visible when tenant matches, session var unset (current app
    -- path), caller is super-admin, OR the row is legacy
    -- (company_id IS NULL). The legacy-null branch is a temporary
    -- bridge for the Phase 2 window; task 2.7 backfills every row
    -- + flips the column to NOT NULL, at which point that branch
    -- becomes dead code.
    EXECUTE format($ddl$
      CREATE POLICY %I ON public.%I
      AS RESTRICTIVE
      FOR SELECT
      USING (
        public.current_company_id() IS NULL
        OR public.is_super_admin()
        OR company_id IS NULL
        OR company_id = public.current_company_id()
      )
    $ddl$, scoped_table || '_tenant_read', scoped_table);

    -- ALL-command policy — INSERT/UPDATE/DELETE guarded on both
    -- read + write directions. WITH CHECK stops a caller from
    -- writing rows into a tenant they're not in.
    EXECUTE format($ddl$
      CREATE POLICY %I ON public.%I
      AS RESTRICTIVE
      FOR ALL
      USING (
        public.current_company_id() IS NULL
        OR public.is_super_admin()
        OR company_id IS NULL
        OR company_id = public.current_company_id()
      )
      WITH CHECK (
        public.current_company_id() IS NULL
        OR public.is_super_admin()
        OR company_id IS NULL
        OR company_id = public.current_company_id()
      )
    $ddl$, scoped_table || '_tenant_write', scoped_table);
  END LOOP;
END $$;

-- ============================================================
-- Companies + memberships — self-referential scoping.
-- ============================================================

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS companies_tenant_read ON public.companies;
CREATE POLICY companies_tenant_read ON public.companies
  AS RESTRICTIVE
  FOR SELECT
  USING (
    public.current_company_id() IS NULL
    OR public.is_super_admin()
    OR id::text = public.current_company_id()
  );

ALTER TABLE public.company_memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_memberships_tenant_read ON public.company_memberships;
CREATE POLICY company_memberships_tenant_read ON public.company_memberships
  AS RESTRICTIVE
  FOR SELECT
  USING (
    public.current_company_id() IS NULL
    OR public.is_super_admin()
    OR company_id = public.current_company_id()
  );
