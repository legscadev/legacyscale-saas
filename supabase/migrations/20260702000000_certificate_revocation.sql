-- Admin-side certificate management: revocation + manual-issue audit.
--
-- Ruby (admin) needs to be able to hand-issue certs for support
-- cases and revoke wrong ones. This migration adds the audit trail
-- without touching the existing auto-issue flow. All columns are
-- nullable so existing rows continue to make sense.
--
-- Types: `text` for the admin id FKs to match users.id (Prisma's
-- `String @id @default(uuid())` maps to text, not uuid).

alter table public.certificate_issuances
  add column if not exists manually_issued_by_id text,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by_id text,
  add column if not exists revoked_reason text;

-- FKs point back at users. SET NULL on delete so an admin leaving
-- doesn't cascade-nuke the historical certs they issued or revoked.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'certificate_issuances_manually_issued_by_id_fkey'
  ) then
    alter table public.certificate_issuances
      add constraint certificate_issuances_manually_issued_by_id_fkey
      foreign key (manually_issued_by_id) references public.users(id)
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'certificate_issuances_revoked_by_id_fkey'
  ) then
    alter table public.certificate_issuances
      add constraint certificate_issuances_revoked_by_id_fkey
      foreign key (revoked_by_id) references public.users(id)
      on delete set null;
  end if;
end
$$;

create index if not exists certificate_issuances_revoked_at_idx
  on public.certificate_issuances (revoked_at);
