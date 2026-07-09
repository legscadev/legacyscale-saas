-- Multi-tenancy Phase 1 — see docs/multi-tenancy.md.
--
-- Adds nullable company_id to every tenant-scoped table so the
-- backfill script in this same migration can stamp them onto every
-- existing row. Phase 2 promotes these to NOT NULL + adds RLS
-- policies that read from a per-request `app.company_id` session
-- variable.
--
-- Skipped intentionally:
--   users             — global identity (memberships handle scope)
--   login_events      — per-user analytics; stays global
--   rate_limits       — IP × action; global
--
-- Companies + CompanyMembership are created by Prisma db push;
-- this file only touches the scoping columns and backfill.
--
-- Idempotent: every add-column uses IF NOT EXISTS; the backfill
-- uses WHERE company_id IS NULL so re-running is a no-op.

-- ────────────────────────────────────────────
-- 1. Add nullable company_id to every scoped table
-- ────────────────────────────────────────────

alter table public.invites                          add column if not exists company_id text;
alter table public.courses                          add column if not exists company_id text;
alter table public.categories                       add column if not exists company_id text;
alter table public.course_categories                add column if not exists company_id text;
alter table public.modules                          add column if not exists company_id text;
alter table public.chapters                         add column if not exists company_id text;
alter table public.lessons                          add column if not exists company_id text;
alter table public.lesson_resources                 add column if not exists company_id text;
alter table public.quiz_questions                   add column if not exists company_id text;
alter table public.quiz_attempts                    add column if not exists company_id text;
alter table public.enrollments                      add column if not exists company_id text;
alter table public.lesson_progress                  add column if not exists company_id text;
alter table public.notes                            add column if not exists company_id text;
alter table public.certificate_issuances            add column if not exists company_id text;
alter table public.announcements                    add column if not exists company_id text;
alter table public.announcement_reads               add column if not exists company_id text;
alter table public.announcement_comments            add column if not exists company_id text;
alter table public.announcement_reactions           add column if not exists company_id text;
alter table public.announcement_audit_logs          add column if not exists company_id text;
alter table public.nudges                           add column if not exists company_id text;
alter table public.stat_divisions                   add column if not exists company_id text;
alter table public.stat_metrics                     add column if not exists company_id text;
alter table public.stat_data_points                 add column if not exists company_id text;
alter table public.org_board_revisions              add column if not exists company_id text;
alter table public.org_nodes                        add column if not exists company_id text;
alter table public.position_details                 add column if not exists company_id text;
alter table public.position_assignments             add column if not exists company_id text;
alter table public.org_node_audit_logs              add column if not exists company_id text;
alter table public.employees                        add column if not exists company_id text;
alter table public.onboarding_checklist_items       add column if not exists company_id text;
alter table public.employee_checklist_item_statuses add column if not exists company_id text;
alter table public.app_settings                     add column if not exists company_id text;

-- ────────────────────────────────────────────
-- 2. Indexes for the coming RLS predicates
-- ────────────────────────────────────────────

create index if not exists invites_company_idx                          on public.invites (company_id);
create index if not exists courses_company_idx                          on public.courses (company_id);
create index if not exists categories_company_idx                       on public.categories (company_id);
create index if not exists course_categories_company_idx                on public.course_categories (company_id);
create index if not exists modules_company_idx                          on public.modules (company_id);
create index if not exists chapters_company_idx                         on public.chapters (company_id);
create index if not exists lessons_company_idx                          on public.lessons (company_id);
create index if not exists lesson_resources_company_idx                 on public.lesson_resources (company_id);
create index if not exists quiz_questions_company_idx                   on public.quiz_questions (company_id);
create index if not exists quiz_attempts_company_idx                    on public.quiz_attempts (company_id);
create index if not exists enrollments_company_idx                      on public.enrollments (company_id);
create index if not exists lesson_progress_company_idx                  on public.lesson_progress (company_id);
create index if not exists notes_company_idx                            on public.notes (company_id);
create index if not exists certificate_issuances_company_idx            on public.certificate_issuances (company_id);
create index if not exists announcements_company_idx                    on public.announcements (company_id);
create index if not exists announcement_reads_company_idx               on public.announcement_reads (company_id);
create index if not exists announcement_comments_company_idx            on public.announcement_comments (company_id);
create index if not exists announcement_reactions_company_idx           on public.announcement_reactions (company_id);
create index if not exists announcement_audit_logs_company_idx          on public.announcement_audit_logs (company_id);
create index if not exists nudges_company_idx                           on public.nudges (company_id);
create index if not exists stat_divisions_company_idx                   on public.stat_divisions (company_id);
create index if not exists stat_metrics_company_idx                     on public.stat_metrics (company_id);
create index if not exists stat_data_points_company_idx                 on public.stat_data_points (company_id);
create index if not exists org_board_revisions_company_idx              on public.org_board_revisions (company_id);
create index if not exists org_nodes_company_idx                        on public.org_nodes (company_id);
create index if not exists position_details_company_idx                 on public.position_details (company_id);
create index if not exists position_assignments_company_idx             on public.position_assignments (company_id);
create index if not exists org_node_audit_logs_company_idx              on public.org_node_audit_logs (company_id);
create index if not exists employees_company_idx                        on public.employees (company_id);
create index if not exists onboarding_checklist_items_company_idx       on public.onboarding_checklist_items (company_id);
create index if not exists employee_checklist_item_statuses_company_idx on public.employee_checklist_item_statuses (company_id);
create index if not exists app_settings_company_idx                     on public.app_settings (company_id);

-- ────────────────────────────────────────────
-- 3. Seed the Kondense company + backfill
-- ────────────────────────────────────────────
--
-- The uuid is stable so future migrations + docs can refer to it.
-- If someone already created a row (via db push seeding), the
-- ON CONFLICT clause keeps this idempotent.

insert into public.companies (id, slug, name, is_agency, updated_at)
values ('00000000-0000-0000-0000-000000000001', 'kondense', 'Kondense', true, now())
on conflict (id) do nothing;

-- Every existing user gets a membership on the seed company. Role
-- maps their legacy top-level role directly: ADMIN → OWNER (Keanu
-- and other founders), TEAM → TEAM, MEMBER → MEMBER. The upsert
-- pattern makes this safe to re-run.
insert into public.company_memberships (id, user_id, company_id, role, updated_at)
select
  gen_random_uuid()::text,
  u.id,
  '00000000-0000-0000-0000-000000000001',
  case u.role
    when 'ADMIN'  then 'OWNER'::public."CompanyRole"
    when 'TEAM'   then 'TEAM'::public."CompanyRole"
    when 'MEMBER' then 'MEMBER'::public."CompanyRole"
  end,
  now()
from public.users u
where u.deleted_at is null
  and not exists (
    select 1 from public.company_memberships m
    where m.user_id = u.id
      and m.company_id = '00000000-0000-0000-0000-000000000001'
  );

-- Backfill company_id on every scoped table. Every existing row
-- belongs to Kondense; sub-accounts are created by later phases.

update public.invites                          set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
update public.courses                          set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
update public.categories                       set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
update public.course_categories                set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
update public.modules                          set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
update public.chapters                         set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
update public.lessons                          set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
update public.lesson_resources                 set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
update public.quiz_questions                   set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
update public.quiz_attempts                    set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
update public.enrollments                      set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
update public.lesson_progress                  set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
update public.notes                            set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
update public.certificate_issuances            set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
update public.announcements                    set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
update public.announcement_reads               set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
update public.announcement_comments            set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
update public.announcement_reactions           set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
update public.announcement_audit_logs          set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
update public.nudges                           set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
update public.stat_divisions                   set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
update public.stat_metrics                     set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
update public.stat_data_points                 set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
update public.org_board_revisions              set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
update public.org_nodes                        set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
update public.position_details                 set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
update public.position_assignments             set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
update public.org_node_audit_logs              set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
update public.employees                        set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
update public.onboarding_checklist_items       set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
update public.employee_checklist_item_statuses set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;
update public.app_settings                     set company_id = '00000000-0000-0000-0000-000000000001' where company_id is null;

-- ────────────────────────────────────────────
-- 4. Foreign keys to public.companies(id)
-- ────────────────────────────────────────────
--
-- Added after the backfill so nothing errors on the NULL rows.
-- Kept idempotent via the pg_constraint existence check block.
-- Phase 2 flips the columns to NOT NULL.

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'invites', 'courses', 'categories', 'course_categories',
    'modules', 'chapters', 'lessons', 'lesson_resources',
    'quiz_questions', 'quiz_attempts', 'enrollments',
    'lesson_progress', 'notes', 'certificate_issuances',
    'announcements', 'announcement_reads', 'announcement_comments',
    'announcement_reactions', 'announcement_audit_logs', 'nudges',
    'stat_divisions', 'stat_metrics', 'stat_data_points',
    'org_board_revisions', 'org_nodes', 'position_details',
    'position_assignments', 'org_node_audit_logs', 'employees',
    'onboarding_checklist_items', 'employee_checklist_item_statuses',
    'app_settings'
  ]
  loop
    if not exists (
      select 1 from pg_constraint
      where conname = tbl || '_company_id_fkey'
    ) then
      execute format(
        'alter table public.%I add constraint %I '
        || 'foreign key (company_id) references public.companies(id) '
        || 'on delete cascade',
        tbl,
        tbl || '_company_id_fkey'
      );
    end if;
  end loop;
end
$$;
