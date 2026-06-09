-- Replace courses.is_internal (boolean) with courses.audience (enum)
-- so a course can be MEMBERS, INTERNAL, or BOTH.

-- 1. Create the enum type if it doesn't exist.
DO $$ BEGIN
  CREATE TYPE "CourseAudience" AS ENUM ('MEMBERS', 'INTERNAL', 'BOTH');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add the audience column with the MEMBERS default.
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS audience "CourseAudience" NOT NULL DEFAULT 'MEMBERS';

-- 3. Backfill from is_internal (only runs if the column still exists),
--    then drop the boolean.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'courses'
      AND column_name = 'is_internal'
  ) THEN
    UPDATE public.courses SET audience = 'INTERNAL' WHERE is_internal = true;
    ALTER TABLE public.courses DROP COLUMN is_internal;
  END IF;
END $$;
