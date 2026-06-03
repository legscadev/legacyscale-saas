-- Lesson-resources Storage bucket + RLS policies.
--
-- Used by Sprint 2 (2.13 create resource lesson). Resources are paid
-- content (PDFs, docs, etc.) and must not be enumerable or directly
-- downloadable via a public URL. Reads happen through short-lived
-- signed URLs generated server-side after an enrollment check.
-- Writes are admin-only via service_role.
--
-- Path convention: lesson-resources/<lesson-id>/<filename>

-- ───────── bucket ─────────

insert into storage.buckets (id, name, public)
values ('lesson-resources', 'lesson-resources', false)
on conflict (id) do nothing;

-- ───────── policies ─────────
--
-- Intentionally no select/insert/update/delete policies for the
-- authenticated or anon roles. All access goes through the service
-- role (createAdminClient on the server), which bypasses RLS:
--   • Admin uploads/replacements/deletes during course authoring.
--   • Member downloads via signed URLs minted after an enrollment
--     check in a server action / API route.
--
-- Leaving the policy table empty here means a stray client-side
-- request fails closed, which is the desired posture.
