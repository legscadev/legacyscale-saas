-- Wide 16:9 hero image for the course detail page. Optional — UIs
-- render a gradient placeholder when null. Distinct from
-- thumbnail_url (the 4:3 card thumbnail).
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS cover_image_url text;
