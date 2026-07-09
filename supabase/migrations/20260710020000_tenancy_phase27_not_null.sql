-- ============================================================
-- Phase 2.7 — flip company_id to NOT NULL
-- ============================================================
-- Every scoped table gets:
--   1. A DEFAULT of the Kondense seed uuid so writes that don't
--      pass company_id (flag-off code path, seed scripts, jobs)
--      land in the pre-tenancy tenant.
--   2. A backfill of any residual nulls (defensive — Phase 1
--      backfill already zero'd this).
--   3. SET NOT NULL.
--
-- Once every write path either sets company_id explicitly (via the
-- Prisma tenancy extension) or falls back to the DEFAULT (via the
-- flag-off no-op branch), the column can safely be non-nullable.
--
-- Idempotent: each step uses IF NOT NULL / etc. so re-running is
-- safe on an already-migrated database.
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
  null_count bigint;
BEGIN
  FOREACH scoped_table IN ARRAY scoped_tables LOOP
    -- 1. Default to the Kondense seed uuid.
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN company_id SET DEFAULT %L',
      scoped_table,
      '00000000-0000-0000-0000-000000000001'
    );

    -- 2. Backfill any residual nulls (should be 0 after Phase 1).
    EXECUTE format(
      'UPDATE public.%I SET company_id = %L WHERE company_id IS NULL',
      scoped_table,
      '00000000-0000-0000-0000-000000000001'
    );

    -- 3. Enforce.
    EXECUTE format('SELECT count(*) FROM public.%I WHERE company_id IS NULL', scoped_table)
      INTO null_count;
    IF null_count > 0 THEN
      RAISE EXCEPTION 'Refusing NOT NULL flip on %: % rows still have NULL company_id', scoped_table, null_count;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN company_id SET NOT NULL', scoped_table);
  END LOOP;
END $$;
