-- ============================================================
-- LEGACY SCALE — ROW-LEVEL SECURITY POLICIES
-- ============================================================
-- Run this in the Supabase SQL Editor (or via psql against
-- DATABASE_URL). Safe to re-run: every policy is dropped before
-- it is recreated, so the script is idempotent.
--
-- IMPORTANT — READ BEFORE RELYING ON THIS:
--
--  1. PRIMARY AUTHORIZATION IS IN THE APP, NOT HERE.
--     The app reads/writes via Prisma using DATABASE_URL (the
--     `postgres` role) and the Supabase service-role key. BOTH
--     BYPASS RLS. So these policies do NOT guard the main query
--     path — `requireUser()` / `requireAdmin()` in the service
--     layer do. RLS here is DEFENSE-IN-DEPTH: it only takes
--     effect for queries made through the Supabase client with
--     the anon/authenticated key (browser queries, Realtime,
--     Storage), now or in the future.
--
--  2. IDENTITY IS MATCHED VIA `auth_id`, NOT `id`.
--     Each user row has two IDs:
--        users.id       -> internal app UUID (all FKs point here)
--        users.auth_id  -> the Supabase auth.users.id
--     auth.uid() returns the Supabase auth id, which equals
--     users.auth_id. Matching against users.id (as naive
--     examples often do) would never match and would lock
--     everyone out. The helpers below resolve auth.uid() ->
--     internal id correctly.
--
--  3. These policies are only meaningful once real auth users
--     exist and have a linked users.auth_id (see task 0.8).
-- ============================================================


-- ============================================================
-- ENABLE RLS ON ALL TABLES (11 total)
-- ============================================================
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules            ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters           ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons            ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress    ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_issuances ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================
-- SECURITY DEFINER lets these read the users table even while
-- RLS is active. `SET search_path = public` prevents
-- search_path hijacking. STABLE allows the planner to evaluate
-- them once per statement.

-- True when the current auth user maps to an active ADMIN.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE auth_id = auth.uid()::text
      AND role = 'ADMIN'
      AND is_active = true
  );
$$;

-- Resolves the current auth user to their internal users.id
-- (the value stored in every *_user_id foreign key).
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.users
  WHERE auth_id = auth.uid()::text
  LIMIT 1;
$$;


-- ============================================================
-- USERS
-- ============================================================
DROP POLICY IF EXISTS "users_select_own"   ON users;
DROP POLICY IF EXISTS "users_update_own"   ON users;
DROP POLICY IF EXISTS "users_admin_all"    ON users;

CREATE POLICY "users_select_own"
  ON users FOR SELECT
  USING (auth_id = auth.uid()::text);

CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  USING (auth_id = auth.uid()::text)
  WITH CHECK (auth_id = auth.uid()::text);

CREATE POLICY "users_admin_all"
  ON users FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- COURSES  (members: published & not deleted)
-- ============================================================
DROP POLICY IF EXISTS "courses_select_published" ON courses;
DROP POLICY IF EXISTS "courses_admin_all"        ON courses;

CREATE POLICY "courses_select_published"
  ON courses FOR SELECT
  USING (
    (status = 'PUBLISHED' AND deleted_at IS NULL)
    OR is_admin()
  );

CREATE POLICY "courses_admin_all"
  ON courses FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- MODULES  (members: parent course published & not deleted)
-- Modules are an optional grouping layer between Course and Chapter.
-- Visibility mirrors chapters: members can see modules whose parent
-- course is PUBLISHED and not soft-deleted; admins see all.
-- ============================================================
DROP POLICY IF EXISTS "modules_select_published" ON modules;
DROP POLICY IF EXISTS "modules_admin_all"        ON modules;

CREATE POLICY "modules_select_published"
  ON modules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = modules.course_id
        AND c.status = 'PUBLISHED'
        AND c.deleted_at IS NULL
    )
    OR is_admin()
  );

CREATE POLICY "modules_admin_all"
  ON modules FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- CHAPTERS  (members: parent course published & not deleted)
-- chapter.course_id stays denormalized even when module_id is set,
-- so this policy doesn't need to traverse the module.
-- ============================================================
DROP POLICY IF EXISTS "chapters_select_published" ON chapters;
DROP POLICY IF EXISTS "chapters_admin_all"        ON chapters;

CREATE POLICY "chapters_select_published"
  ON chapters FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = chapters.course_id
        AND c.status = 'PUBLISHED'
        AND c.deleted_at IS NULL
    )
    OR is_admin()
  );

CREATE POLICY "chapters_admin_all"
  ON chapters FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- LESSONS  (members: READY lessons in published, non-deleted courses)
-- ============================================================
DROP POLICY IF EXISTS "lessons_select_ready" ON lessons;
DROP POLICY IF EXISTS "lessons_admin_all"    ON lessons;

CREATE POLICY "lessons_select_ready"
  ON lessons FOR SELECT
  USING (
    (
      lessons.status = 'READY'
      AND EXISTS (
        SELECT 1
        FROM chapters ch
        JOIN courses c ON c.id = ch.course_id
        WHERE ch.id = lessons.chapter_id
          AND c.status = 'PUBLISHED'
          AND c.deleted_at IS NULL
      )
    )
    OR is_admin()
  );

CREATE POLICY "lessons_admin_all"
  ON lessons FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- QUIZ QUESTIONS  (members: questions in readable lessons)
-- NOTE: correct_index is sensitive. RLS exposes the whole row,
-- so when read via the Supabase client this leaks answers.
-- Serve quiz questions through the API (Prisma) with
-- correct_index stripped; keep member reads here as a fallback.
-- ============================================================
DROP POLICY IF EXISTS "quiz_questions_select" ON quiz_questions;
DROP POLICY IF EXISTS "quiz_questions_admin_all" ON quiz_questions;

CREATE POLICY "quiz_questions_select"
  ON quiz_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM lessons l
      JOIN chapters ch ON ch.id = l.chapter_id
      JOIN courses c   ON c.id = ch.course_id
      WHERE l.id = quiz_questions.lesson_id
        AND l.status = 'READY'
        AND c.status = 'PUBLISHED'
        AND c.deleted_at IS NULL
    )
    OR is_admin()
  );

CREATE POLICY "quiz_questions_admin_all"
  ON quiz_questions FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- QUIZ ATTEMPTS  (members: own; create own)
-- ============================================================
DROP POLICY IF EXISTS "quiz_attempts_select_own" ON quiz_attempts;
DROP POLICY IF EXISTS "quiz_attempts_insert_own" ON quiz_attempts;
DROP POLICY IF EXISTS "quiz_attempts_admin_all"  ON quiz_attempts;

CREATE POLICY "quiz_attempts_select_own"
  ON quiz_attempts FOR SELECT
  USING (user_id = public.current_user_id());

CREATE POLICY "quiz_attempts_insert_own"
  ON quiz_attempts FOR INSERT
  WITH CHECK (user_id = public.current_user_id());

CREATE POLICY "quiz_attempts_admin_all"
  ON quiz_attempts FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- ENROLLMENTS  (members: own; create own)
-- ============================================================
DROP POLICY IF EXISTS "enrollments_select_own" ON enrollments;
DROP POLICY IF EXISTS "enrollments_insert_own" ON enrollments;
DROP POLICY IF EXISTS "enrollments_admin_all"  ON enrollments;

CREATE POLICY "enrollments_select_own"
  ON enrollments FOR SELECT
  USING (user_id = public.current_user_id());

CREATE POLICY "enrollments_insert_own"
  ON enrollments FOR INSERT
  WITH CHECK (user_id = public.current_user_id());

CREATE POLICY "enrollments_admin_all"
  ON enrollments FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- LESSON PROGRESS  (members: own; create + update own)
-- ============================================================
DROP POLICY IF EXISTS "lesson_progress_select_own" ON lesson_progress;
DROP POLICY IF EXISTS "lesson_progress_insert_own" ON lesson_progress;
DROP POLICY IF EXISTS "lesson_progress_update_own" ON lesson_progress;
DROP POLICY IF EXISTS "lesson_progress_admin_all"  ON lesson_progress;

CREATE POLICY "lesson_progress_select_own"
  ON lesson_progress FOR SELECT
  USING (user_id = public.current_user_id());

CREATE POLICY "lesson_progress_insert_own"
  ON lesson_progress FOR INSERT
  WITH CHECK (user_id = public.current_user_id());

CREATE POLICY "lesson_progress_update_own"
  ON lesson_progress FOR UPDATE
  USING (user_id = public.current_user_id())
  WITH CHECK (user_id = public.current_user_id());

CREATE POLICY "lesson_progress_admin_all"
  ON lesson_progress FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- CERTIFICATE ISSUANCES  (members: read-only own; service-role writes)
-- ============================================================
-- Writes always come from the server (auto-issue hook after lesson
-- completion uses the service-role admin client), so we don't grant
-- INSERT/UPDATE to members. SELECT is scoped to the row's user_id
-- so the Certificates tab can list them under anon/authenticated.
DROP POLICY IF EXISTS "certificate_issuances_select_own" ON certificate_issuances;
DROP POLICY IF EXISTS "certificate_issuances_admin_all"  ON certificate_issuances;

CREATE POLICY "certificate_issuances_select_own"
  ON certificate_issuances FOR SELECT
  USING (user_id = public.current_user_id());

CREATE POLICY "certificate_issuances_admin_all"
  ON certificate_issuances FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- NOTES  (members: full CRUD on own)
-- ============================================================
DROP POLICY IF EXISTS "notes_select_own" ON notes;
DROP POLICY IF EXISTS "notes_insert_own" ON notes;
DROP POLICY IF EXISTS "notes_update_own" ON notes;
DROP POLICY IF EXISTS "notes_delete_own" ON notes;
DROP POLICY IF EXISTS "notes_admin_all"  ON notes;

CREATE POLICY "notes_select_own"
  ON notes FOR SELECT
  USING (user_id = public.current_user_id());

CREATE POLICY "notes_insert_own"
  ON notes FOR INSERT
  WITH CHECK (user_id = public.current_user_id());

CREATE POLICY "notes_update_own"
  ON notes FOR UPDATE
  USING (user_id = public.current_user_id())
  WITH CHECK (user_id = public.current_user_id());

CREATE POLICY "notes_delete_own"
  ON notes FOR DELETE
  USING (user_id = public.current_user_id());

CREATE POLICY "notes_admin_all"
  ON notes FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- ANNOUNCEMENTS  (members: published & not deleted)
-- ============================================================
DROP POLICY IF EXISTS "announcements_select_published" ON announcements;
DROP POLICY IF EXISTS "announcements_admin_all"        ON announcements;

CREATE POLICY "announcements_select_published"
  ON announcements FOR SELECT
  USING (
    (status = 'PUBLISHED' AND deleted_at IS NULL)
    OR is_admin()
  );

CREATE POLICY "announcements_admin_all"
  ON announcements FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- ANNOUNCEMENT READS  (members: own; create + delete own)
-- ============================================================
DROP POLICY IF EXISTS "announcement_reads_select_own" ON announcement_reads;
DROP POLICY IF EXISTS "announcement_reads_insert_own" ON announcement_reads;
DROP POLICY IF EXISTS "announcement_reads_delete_own" ON announcement_reads;
DROP POLICY IF EXISTS "announcement_reads_admin_all"  ON announcement_reads;

CREATE POLICY "announcement_reads_select_own"
  ON announcement_reads FOR SELECT
  USING (user_id = public.current_user_id());

CREATE POLICY "announcement_reads_insert_own"
  ON announcement_reads FOR INSERT
  WITH CHECK (user_id = public.current_user_id());

CREATE POLICY "announcement_reads_delete_own"
  ON announcement_reads FOR DELETE
  USING (user_id = public.current_user_id());

CREATE POLICY "announcement_reads_admin_all"
  ON announcement_reads FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- SPRINT 7.1 — COMPLETE COVERAGE FOR REMAINING TABLES
-- ============================================================
-- The original block above covers the 12 tables that existed when
-- this file was first authored. The 9 tables below were added in
-- later sprints (announcements comments/reactions/audit, lesson
-- resources, invites, login events, app settings, categories
-- junction). Adding RLS now closes the defense-in-depth gap so
-- any future client-side query path stays safe.
-- ============================================================

ALTER TABLE announcement_comments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_audit_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_resources         ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories               ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_categories        ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- ANNOUNCEMENT_COMMENTS
-- Visibility tracks the parent announcement (PUBLISHED & not
-- deleted). Members can create + delete their own comments.
-- ============================================================
DROP POLICY IF EXISTS "announcement_comments_select_published" ON announcement_comments;
DROP POLICY IF EXISTS "announcement_comments_insert_own"       ON announcement_comments;
DROP POLICY IF EXISTS "announcement_comments_delete_own"       ON announcement_comments;
DROP POLICY IF EXISTS "announcement_comments_admin_all"        ON announcement_comments;

CREATE POLICY "announcement_comments_select_published"
  ON announcement_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM announcements a
      WHERE a.id = announcement_comments.announcement_id
        AND a.status = 'PUBLISHED'
        AND a.deleted_at IS NULL
    )
    OR is_admin()
  );

CREATE POLICY "announcement_comments_insert_own"
  ON announcement_comments FOR INSERT
  WITH CHECK (user_id = public.current_user_id());

CREATE POLICY "announcement_comments_delete_own"
  ON announcement_comments FOR DELETE
  USING (user_id = public.current_user_id());

CREATE POLICY "announcement_comments_admin_all"
  ON announcement_comments FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- ANNOUNCEMENT_REACTIONS
-- Same visibility model as comments; (user_id, announcement_id,
-- emoji) is unique so members can only toggle their own row.
-- ============================================================
DROP POLICY IF EXISTS "announcement_reactions_select_published" ON announcement_reactions;
DROP POLICY IF EXISTS "announcement_reactions_insert_own"       ON announcement_reactions;
DROP POLICY IF EXISTS "announcement_reactions_delete_own"       ON announcement_reactions;
DROP POLICY IF EXISTS "announcement_reactions_admin_all"        ON announcement_reactions;

CREATE POLICY "announcement_reactions_select_published"
  ON announcement_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM announcements a
      WHERE a.id = announcement_reactions.announcement_id
        AND a.status = 'PUBLISHED'
        AND a.deleted_at IS NULL
    )
    OR is_admin()
  );

CREATE POLICY "announcement_reactions_insert_own"
  ON announcement_reactions FOR INSERT
  WITH CHECK (user_id = public.current_user_id());

CREATE POLICY "announcement_reactions_delete_own"
  ON announcement_reactions FOR DELETE
  USING (user_id = public.current_user_id());

CREATE POLICY "announcement_reactions_admin_all"
  ON announcement_reactions FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- ANNOUNCEMENT_AUDIT_LOGS — admin-only.
-- Audit rows are sensitive (who-did-what); members never read.
-- ============================================================
DROP POLICY IF EXISTS "announcement_audit_logs_admin_all" ON announcement_audit_logs;

CREATE POLICY "announcement_audit_logs_admin_all"
  ON announcement_audit_logs FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- LESSON_RESOURCES — gated by visibility of the parent lesson.
-- Mirrors the lessons policy: READY status, course PUBLISHED,
-- not soft-deleted. Admins see all.
-- ============================================================
DROP POLICY IF EXISTS "lesson_resources_select_ready" ON lesson_resources;
DROP POLICY IF EXISTS "lesson_resources_admin_all"    ON lesson_resources;

CREATE POLICY "lesson_resources_select_ready"
  ON lesson_resources FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM lessons l
      JOIN chapters ch ON ch.id = l.chapter_id
      JOIN courses c ON c.id = ch.course_id
      WHERE l.id = lesson_resources.lesson_id
        AND l.status = 'READY'
        AND l.deleted_at IS NULL
        AND c.status = 'PUBLISHED'
        AND c.deleted_at IS NULL
    )
    OR is_admin()
  );

CREATE POLICY "lesson_resources_admin_all"
  ON lesson_resources FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- INVITES — admin reads all; user reads only their own.
-- The onboarding flow runs through Prisma (RLS bypassed), so the
-- "user reads own" branch is defense-in-depth for any future
-- client-side claim path. Inserts and updates only via admin /
-- service role — no member should ever write invites.
-- ============================================================
DROP POLICY IF EXISTS "invites_select_own"   ON invites;
DROP POLICY IF EXISTS "invites_admin_all"    ON invites;

CREATE POLICY "invites_select_own"
  ON invites FOR SELECT
  USING (user_id = public.current_user_id());

CREATE POLICY "invites_admin_all"
  ON invites FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- LOGIN_EVENTS — user reads own; admin reads all. Inserts always
-- via Prisma at sign-in time (service role / postgres) so no
-- INSERT policy is needed for authenticated users.
-- ============================================================
DROP POLICY IF EXISTS "login_events_select_own"   ON login_events;
DROP POLICY IF EXISTS "login_events_admin_all"    ON login_events;

CREATE POLICY "login_events_select_own"
  ON login_events FOR SELECT
  USING (user_id = public.current_user_id());

CREATE POLICY "login_events_admin_all"
  ON login_events FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- APP_SETTINGS — admin-only. Holds Discord webhooks, signing
-- secrets, and other platform config. Members never read or write.
-- Default-deny: no permissive policy for non-admins.
-- ============================================================
DROP POLICY IF EXISTS "app_settings_admin_all" ON app_settings;

CREATE POLICY "app_settings_admin_all"
  ON app_settings FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- CATEGORIES — public read (low-sensitivity taxonomy); admin write.
-- Members need this to render the category selector + filter
-- catalogues. There is no per-user scope.
-- ============================================================
DROP POLICY IF EXISTS "categories_select_all" ON categories;
DROP POLICY IF EXISTS "categories_admin_all"  ON categories;

CREATE POLICY "categories_select_all"
  ON categories FOR SELECT
  USING (true);

CREATE POLICY "categories_admin_all"
  ON categories FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- COURSE_CATEGORIES — public read (visible to anyone who can
-- already see the course); admin-only write.
-- ============================================================
DROP POLICY IF EXISTS "course_categories_select_all" ON course_categories;
DROP POLICY IF EXISTS "course_categories_admin_all"  ON course_categories;

CREATE POLICY "course_categories_select_all"
  ON course_categories FOR SELECT
  USING (true);

CREATE POLICY "course_categories_admin_all"
  ON course_categories FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());


-- ============================================================
-- VERIFICATION
-- ============================================================
-- Confirm RLS is enabled on every table (now 21):
--   SELECT relname, relrowsecurity
--   FROM pg_class
--   WHERE relname IN (
--     'users','courses','modules','chapters','lessons','quiz_questions',
--     'quiz_attempts','enrollments','lesson_progress','notes',
--     'announcements','announcement_reads','announcement_comments',
--     'announcement_reactions','announcement_audit_logs','lesson_resources',
--     'invites','login_events','app_settings','categories','course_categories'
--   );
--
-- List all policies:
--   SELECT tablename, policyname, cmd
--   FROM pg_policies
--   WHERE schemaname = 'public'
--   ORDER BY tablename, policyname;
-- ============================================================
