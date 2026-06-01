# Supabase migrations

Hand-written SQL for resources Prisma doesn't own — Storage buckets,
Storage/Auth RLS policies, Postgres extensions, triggers, etc.

## Layout

    supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql

Filenames use a UTC timestamp prefix so they apply in order. One concern
per file; never rewrite a merged migration.

## Applying a new migration

Until the Supabase CLI is wired up, apply by hand:

1. Open Supabase Studio → SQL Editor.
2. Paste the file contents and run it.
3. Run the same SQL against every environment (dev, staging, prod).

A future improvement is to adopt `supabase db push` so this is automatic.
