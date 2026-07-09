-- Track continuous session activity, not just explicit sign-in.
--
-- lastLoginAt is only bumped by syncUserToDatabase on the login
-- flow. Users who stay signed in and browse over days would keep
-- an outdated "Last active" value on /admin/team + /admin/members.
--
-- The new column is stamped from getUser() at request time,
-- debounced to once per 15 minutes per user (see lib/auth/get-user.ts).
-- A NULL value here means the row predates this feature — the UI
-- falls back to last_login_at until the user hits any page.

alter table public.users
  add column if not exists last_active_at timestamptz;

-- Backfill the new column with last_login_at so existing rows have
-- a sensible starting value in the UI immediately.
update public.users
  set last_active_at = last_login_at
  where last_active_at is null
    and last_login_at is not null;
