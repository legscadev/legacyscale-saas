-- Admin nudge messages.
--
-- Ruby (admin) wants to re-engage stalled members. This table backs
-- the manual per-member workflow: admin sends → Resend fires an
-- email AND the member sees a dismissible banner on their next
-- dashboard visit. Delivery + dismissal are tracked separately so
-- neither blocks the other.
--
-- Types: all id columns are `text` to match Prisma's `String @id`
-- mapping (users.id / courses.id are both text).

create table if not exists public.nudges (
  id             text primary key default (gen_random_uuid())::text,
  user_id        text not null references public.users(id)   on delete cascade,
  course_id      text references public.courses(id)          on delete set null,
  message        text not null,
  created_by_id  text not null references public.users(id)   on delete restrict,
  created_at     timestamptz not null default now(),
  email_sent_at  timestamptz,
  dismissed_at   timestamptz
);

create index if not exists nudges_user_dismissed_idx
  on public.nudges (user_id, dismissed_at);

create index if not exists nudges_created_at_idx
  on public.nudges (created_at desc);
