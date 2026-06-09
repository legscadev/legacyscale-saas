-- Course-thumbnails Storage bucket + RLS policies.
--
-- Used by Sprint 2 (2.2 course create / 2.3 course edit). Thumbnails
-- render directly in <img> tags across the catalogue, so reads are
-- public. Writes are admin-only and go through a server action that
-- uses the service_role key — RLS leaves no write policy in place,
-- so non-service requests are denied by default.
--
-- Path convention: course-thumbnails/<course-id>/<filename>

-- ───────── bucket ─────────

insert into storage.buckets (id, name, public)
values ('course-thumbnails', 'course-thumbnails', true)
on conflict (id) do nothing;

-- ───────── policies ─────────

-- Anyone can view thumbnails (rendered publicly in course cards).
create policy "course_thumbnails_select_public"
on storage.objects for select
using (bucket_id = 'course-thumbnails');

-- No insert/update/delete policies: admin uploads run server-side
-- with the service_role key, which bypasses RLS. Authenticated
-- clients have no direct write path.
