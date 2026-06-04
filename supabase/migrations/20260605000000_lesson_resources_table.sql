-- Multi-resource lessons (1:many LessonResource).
--
-- Splits the single resourceUrl/resourceName/resourceSize columns on
-- `lessons` into a separate `lesson_resources` table so a lesson can
-- own many attachments. Each file lives in the lesson-resources
-- Storage bucket at `<lessonId>/<resourceId>`.
--
-- Idempotent — safe to re-run on dev (already applied) or prod
-- (pristine). The backfill block only fires while the old columns
-- still exist on `lessons`, so re-runs after the DROP COLUMN are
-- no-ops.

BEGIN;

-- ───────── new table ─────────

CREATE TABLE IF NOT EXISTS "lesson_resources" (
  "id"         TEXT         PRIMARY KEY,
  "lesson_id"  TEXT         NOT NULL,
  "name"       TEXT         NOT NULL,
  "path"       TEXT         NOT NULL,
  "size"       INTEGER      NOT NULL,
  "mime_type"  TEXT         NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "lesson_resources_lesson_id_fkey"
    FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "lesson_resources_lesson_id_created_at_idx"
  ON "lesson_resources" ("lesson_id", "created_at");

-- ───────── backfill (prod-safe; dev no-op) ─────────
--
-- If the old single-resource columns still exist, copy any non-null
-- rows into the new table before the DROP COLUMN below removes the
-- data. mime_type wasn't tracked in the old schema, so we fall back
-- to the generic application/octet-stream — admins can re-upload or
-- the column can be backfilled later if needed.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'lessons'
       AND column_name = 'resource_url'
  ) THEN
    EXECUTE $sql$
      INSERT INTO "lesson_resources" (id, lesson_id, name, path, size, mime_type)
      SELECT
        gen_random_uuid()::text,
        id,
        COALESCE(resource_name, 'attachment'),
        resource_url,
        COALESCE(resource_size, 0),
        'application/octet-stream'
      FROM "lessons"
      WHERE resource_url IS NOT NULL
        AND type = 'RESOURCE'
      ON CONFLICT DO NOTHING;
    $sql$;
  END IF;
END $$;

-- ───────── drop old columns ─────────

ALTER TABLE "lessons" DROP COLUMN IF EXISTS "resource_url";
ALTER TABLE "lessons" DROP COLUMN IF EXISTS "resource_name";
ALTER TABLE "lessons" DROP COLUMN IF EXISTS "resource_size";

COMMIT;
