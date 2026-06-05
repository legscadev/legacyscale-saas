-- Add a free-access flag to courses. When true, any signed-in MEMBER
-- can open the course without an Enrollment row. Default false keeps
-- every existing course on the original enrollment-required gate.
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS is_free boolean NOT NULL DEFAULT false;
