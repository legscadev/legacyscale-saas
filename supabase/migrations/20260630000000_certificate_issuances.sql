-- Per-module certificate issuance table.
--
-- One row per (user, module) the moment the member has completed
-- every lesson in that module. The presence of a row IS the
-- eligibility signal — the PDF itself is rendered lazily on first
-- download and cached in the `course-certificates` Storage bucket
-- under `<issuance-id>.pdf`. shortCode is the public-facing
-- identifier stamped on the PDF and shown in the member's
-- Certificates tab (random base32, retried on collision).
--
-- Idempotency: (user_id, module_id) is unique, so the lesson-progress
-- hook can fire issueIfEligible on every "mark complete" without
-- worrying about duplicates.
--
-- Types: all id columns are `text` to match the rest of the schema.
-- Prisma's `String @id @default(uuid())` maps to `text`, not `uuid`,
-- so FKs to users/modules/courses must also be text or the FK
-- constraint fails with "incompatible types: uuid and text".

create table if not exists public.certificate_issuances (
  id          text primary key default (gen_random_uuid())::text,
  user_id     text not null references public.users(id)    on delete cascade,
  module_id   text not null references public.modules(id)  on delete cascade,
  course_id   text not null references public.courses(id)  on delete cascade,
  short_code  text not null,
  issued_at   timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  constraint certificate_issuances_user_module_uk
    unique (user_id, module_id),
  constraint certificate_issuances_short_code_uk
    unique (short_code)
);

create index if not exists certificate_issuances_user_issued_idx
  on public.certificate_issuances (user_id, issued_at desc);

create index if not exists certificate_issuances_course_idx
  on public.certificate_issuances (course_id);
