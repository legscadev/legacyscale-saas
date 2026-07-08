-- Statistics tracker — Hubbard-style Divisions → Metrics → Data
-- points. Ruby (admin) creates divisions + metric cards, assigns
-- metrics to team members, and those users record values week over
-- week. Charts read from stat_data_points ordered by recorded_at.
--
-- Types: text ids everywhere to match Prisma's `String @id` → text
-- mapping (users.id + all our other pk columns are text). Decimal
-- values use numeric(18,4) to cover $ and count use-cases.

-- ─────────── unit enum ───────────

do $$
begin
  if not exists (select 1 from pg_type where typname = 'StatMetricUnit') then
    create type "StatMetricUnit" as enum ('COUNT', 'CURRENCY', 'PERCENT');
  end if;
end
$$;

-- ─────────── divisions ───────────

create table if not exists public.stat_divisions (
  id            text primary key default (gen_random_uuid())::text,
  name          text not null,
  short_label   text,
  description   text,
  order_index   integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists stat_divisions_order_idx
  on public.stat_divisions (order_index);
create index if not exists stat_divisions_deleted_at_idx
  on public.stat_divisions (deleted_at);

-- ─────────── metrics ───────────

create table if not exists public.stat_metrics (
  id             text primary key default (gen_random_uuid())::text,
  division_id    text not null references public.stat_divisions(id) on delete cascade,
  name           text not null,
  description    text,
  unit           "StatMetricUnit" not null default 'COUNT',
  assigned_to_id text references public.users(id) on delete set null,
  order_index    integer not null default 0,
  target_value   numeric(18, 4),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create index if not exists stat_metrics_division_order_idx
  on public.stat_metrics (division_id, order_index);
create index if not exists stat_metrics_assigned_idx
  on public.stat_metrics (assigned_to_id);
create index if not exists stat_metrics_deleted_at_idx
  on public.stat_metrics (deleted_at);

-- ─────────── data points ───────────

create table if not exists public.stat_data_points (
  id             text primary key default (gen_random_uuid())::text,
  metric_id      text not null references public.stat_metrics(id) on delete cascade,
  value          numeric(18, 4) not null,
  recorded_at    date not null,
  note           text,
  created_by_id  text references public.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint stat_data_points_metric_recorded_uk
    unique (metric_id, recorded_at)
);

create index if not exists stat_data_points_metric_recorded_idx
  on public.stat_data_points (metric_id, recorded_at);
