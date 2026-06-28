-- Course-certificates Storage bucket + RLS posture.
--
-- Used by Sprint 6 (6.2 completion certificate). Each member's
-- generated PDF cert is uploaded once on first download, then served
-- via a short-lived signed URL. Members must NOT be able to enumerate
-- or directly download another member's certificate.
--
-- Path convention: course-certificates/<enrollment-id>.pdf
--
-- Without this bucket on production, certificate-service.ts's
-- createSignedUrl('course-certificates', ...) fails at runtime, which
-- breaks the "Download certificate" CTA on the completion page.

-- ───────── bucket ─────────

-- Upsert so the public flag gets corrected even when the bucket was
-- previously created (e.g. manually in the dashboard with public=true).
-- We want this bucket to ALWAYS be private — signed URLs only.
insert into storage.buckets (id, name, public)
values ('course-certificates', 'course-certificates', false)
on conflict (id) do update
  set public = excluded.public;

-- ───────── policies ─────────
--
-- Intentionally no select/insert/update/delete policies for the
-- authenticated or anon roles. All access goes through the service
-- role (createAdminClient on the server):
--   • Server-side generation + upload by certificate-service.
--   • Member downloads via signed URLs minted after a completion
--     check in the certificate route.
--
-- An empty policy table fails closed for any stray client-side
-- request, which is the desired posture for paid course artifacts.
