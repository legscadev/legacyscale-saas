-- =============================================================
-- Prod schema sync — 2026-06-25
--
-- Catches a production DB up to the schema state on `develop` after
-- the 9 commits pushed today. Every statement is idempotent (IF NOT
-- EXISTS / IF EXISTS / "skip when already done") so re-running is a
-- safe no-op. The whole thing runs in a single transaction — any
-- failure rolls back cleanly.
--
-- Why this exists: the schema changes this sprint were applied via
-- `prisma db push` (no migration files were generated). Without a
-- runbook, pushing the new code to main would deploy app code that
-- expects columns/tables/enum values that prod hasn't received yet,
-- leading to 500s on any request that touches a slug, a category,
-- or a course completion.
--
-- ── HOW TO RUN ──────────────────────────────────────────────────
--
--   1. Dry-run preview (change COMMIT → ROLLBACK at the bottom):
--        psql "$PROD_DB_URL" -f scripts/2026-06-25-prod-schema-sync.sql
--
--   2. Real run (with COMMIT — current state of file):
--        psql "$PROD_DB_URL" -f scripts/2026-06-25-prod-schema-sync.sql
--
--   Use the DIRECT (5432) connection, not the pgbouncer pooler
--   (6543) — DDL on the pooler can hang. Per existing convention.
--
-- ── EXPECTED OUTPUT ON A FIRST RUN ──────────────────────────────
--   - Course.slug column added, backfilled, constrained
--   - categories + course_categories tables created
--   - EnrollmentStatus enum gains COMPLETED
--   - users.notify_announcement_discord column dropped
--
-- ── EXPECTED OUTPUT ON A RE-RUN ─────────────────────────────────
--   - "NOTICE: relation … already exists, skipping" lines, no errors,
--     no row updates. Safe.
-- =============================================================

\set ON_ERROR_STOP on
BEGIN;

-- 1️⃣  Course.slug  (add nullable → backfill → constrain non-null + unique)
--     Mirrors the two-step "prisma db push" sequence we ran in dev so
--     existing rows always have a value before the NOT NULL takes effect.

ALTER TABLE courses ADD COLUMN IF NOT EXISTS slug TEXT;

-- Inline slugify: lowercase, collapse non-alphanumeric runs to '-',
-- trim leading/trailing hyphens, cap at 80 chars. Mirrors lib/utils/slug.ts
-- behaviour for ASCII input. Non-ASCII titles produce a fallback of
-- 'course'. Collision suffix uses -2, -3, … against current slug set.

DO $$
DECLARE
  r RECORD;
  base TEXT;
  candidate TEXT;
  n INT;
BEGIN
  FOR r IN
    SELECT id, title FROM courses WHERE slug IS NULL ORDER BY created_at ASC
  LOOP
    base := lower(regexp_replace(r.title, '[^a-zA-Z0-9]+', '-', 'g'));
    base := regexp_replace(base, '^-+|-+$', '', 'g');
    IF length(base) = 0 THEN base := 'course'; END IF;
    base := substring(base, 1, 80);

    candidate := base;
    n := 1;
    WHILE EXISTS (
      SELECT 1 FROM courses WHERE slug = candidate AND id <> r.id
    ) LOOP
      n := n + 1;
      candidate := substring(base, 1, 80 - length(n::text) - 1) || '-' || n::text;
    END LOOP;

    UPDATE courses SET slug = candidate WHERE id = r.id;
    RAISE NOTICE 'Backfilled slug for %: % → %', r.id, r.title, candidate;
  END LOOP;
END $$;

-- Tighten the column. Re-runs no-op because the column is already NOT NULL.
ALTER TABLE courses ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS courses_slug_key ON courses(slug);

-- 2️⃣  categories table

CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS categories_name_key ON categories(name);
CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_key ON categories(slug);

-- 3️⃣  course_categories junction table

CREATE TABLE IF NOT EXISTS course_categories (
  course_id   TEXT NOT NULL,
  category_id TEXT NOT NULL,
  created_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (course_id, category_id)
);

-- Foreign keys: add only if not present (FKs don't support IF NOT EXISTS,
-- so we check pg_constraint first).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'course_categories_course_id_fkey'
  ) THEN
    ALTER TABLE course_categories
      ADD CONSTRAINT course_categories_course_id_fkey
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'course_categories_category_id_fkey'
  ) THEN
    ALTER TABLE course_categories
      ADD CONSTRAINT course_categories_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS course_categories_category_id_idx
  ON course_categories(category_id);

-- 4️⃣  EnrollmentStatus.COMPLETED enum value
--     ALTER TYPE … ADD VALUE supports IF NOT EXISTS (Postgres 9.6+),
--     and as of Postgres 12 it works inside a transaction. Supabase
--     runs Postgres 15+, so this is safe here.

ALTER TYPE "EnrollmentStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';

-- 5️⃣  Drop User.notify_announcement_discord
--     The UI was removed today (commit 0b142c2) and nothing reads the
--     column. On a first run this discards any stored values; on a
--     re-run it's a no-op.

ALTER TABLE users DROP COLUMN IF EXISTS notify_announcement_discord;

COMMIT;

\echo '✅ Prod schema sync complete.'
