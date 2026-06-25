# Prisma migrations

This project uses `prisma migrate` for schema changes. Every change is
captured as a versioned SQL migration file in `prisma/migrations/`,
applied automatically to the prod DB by Vercel's build command.

## TL;DR — daily workflow

```bash
# 1. Edit prisma/schema.prisma with your change.
# 2. Generate a migration file + apply it to your local dev DB:
pnpm migrate:dev --name <kebab_case_description>

# 3. Commit the new prisma/migrations/<timestamp>_<name>/ folder.
# 4. Push. Vercel build runs `prisma migrate deploy` → applies it to prod.
```

That's it. No more manual schema sync scripts.

## What changed in this adoption (2026-06-25)

- **`prisma.config.ts`** (new) — Prisma 7 moved datasource URL config
  out of `schema.prisma` and into this file. Uses `DIRECT_URL` (port
  5432, no pgbouncer) for migrate operations, falls back to
  `DATABASE_URL` when `DIRECT_URL` isn't set.
- **`DIRECT_URL`** env var — required for `prisma migrate` to work
  reliably against Supabase. Same host/credentials as `DATABASE_URL`,
  just port 5432 with no `?pgbouncer=true` param.
- **`prisma/migrations/`** (new) — versioned migration history. The
  first entry, `*_init`, is a baseline that captures the entire
  schema as of 2026-06-25.
- **`build` script** now runs `prisma migrate deploy && next build`,
  so any pending migrations apply before the new code is served.

## One-time prod adoption (do this BEFORE merging develop → main)

The dev DB already has the baseline marked as applied. Prod doesn't.
Run these once against prod:

### 1. Apply the schema-sync runbook from earlier today

Brings prod up to the same schema state dev is at.

```bash
# Use the DIRECT (5432) connection URL — never the pooler for DDL.
psql "$PROD_DIRECT_URL" -f scripts/2026-06-25-prod-schema-sync.sql
```

### 2. Set `DATABASE_URL` and `DIRECT_URL` in Vercel

Project Settings → Environment Variables → Production:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Supabase **Transaction-mode pooler** URL (port 6543, `?pgbouncer=true`) |
| `DIRECT_URL` | Supabase **direct** URL (port 5432, no pgbouncer param) |

### 3. Mark the baseline as applied on prod

Tells Prisma "the schema is already here — don't try to re-create it."
Run from your local machine with the prod URLs exported:

```bash
DATABASE_URL="$PROD_POOLER_URL" \
DIRECT_URL="$PROD_DIRECT_URL" \
  pnpm prisma migrate resolve --applied 20260625003112_init
```

You should see: `Migration 20260625003112_init marked as applied.`

### 4. Verify

```bash
DATABASE_URL="$PROD_POOLER_URL" \
DIRECT_URL="$PROD_DIRECT_URL" \
  pnpm migrate:status
```

Expected: `Database schema is up to date!`

### 5. Now safe to merge develop → main

Vercel build runs `prisma migrate deploy` → sees baseline already
applied → 0 pending migrations → `next build` proceeds → deploy
goes live.

## Future schema changes — step by step

```bash
# 1. Edit prisma/schema.prisma. Example: add a field.

# 2. Generate the migration file + apply to dev DB:
pnpm migrate:dev --name add_user_phone

# Output:
#   The following migration(s) have been created and applied:
#   migrations/
#     └─ 20260626100000_add_user_phone/
#        └─ migration.sql

# 3. Commit:
git add prisma/migrations/20260626100000_add_user_phone prisma/schema.prisma
git commit -m "feat(user): add phone column"

# 4. Push:
git push

# 5. Vercel build runs `prisma migrate deploy` → applies the new
#    migration to prod → builds + deploys the app.
```

## Rolling back

Prisma doesn't auto-generate down-migrations. To revert a bad migration:

```bash
# 1. Write a new migration that undoes the change (the safe way).
pnpm migrate:dev --name revert_user_phone

# 2. Or: manually mark a migration as rolled back if you fixed prod
#    via psql:
pnpm prisma migrate resolve --rolled-back 20260626100000_add_user_phone
```

## Why we use `directUrl` (Supabase + pgbouncer notes)

Supabase's connection pooler runs pgbouncer in transaction-pooling
mode. This breaks `prisma migrate` because migrate uses session-scoped
DDL commands (`ALTER TYPE`, transaction blocks for migrations, etc.)
that aren't compatible with transaction pooling. The runtime app's
queries are fine on the pooler, but DDL must go through a direct
connection.

`prisma.config.ts` reads `DIRECT_URL` first, so `migrate` always uses
the direct connection. The app's runtime client (lib/prisma.ts) keeps
reading `DATABASE_URL` for its pg.Pool.

## Why `prisma generate` runs on every install

The `postinstall` script runs `prisma generate`, which produces the
TypeScript Prisma Client from `schema.prisma`. This is required after
every `pnpm install` (including in Vercel) so the generated client
matches the current schema. It does NOT touch the database — only
generates type definitions.

## Decommissioning the old runbook

`scripts/2026-06-25-prod-schema-sync.sql` becomes a historical record
once prod is on the baseline. Keep the file (useful audit trail), but
don't run it again — `prisma migrate deploy` is now the source of
truth for prod schema changes.
