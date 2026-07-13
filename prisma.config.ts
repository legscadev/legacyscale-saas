// Prisma 7 moved datasource URL config out of schema.prisma and into
// this file. Keeps prisma migrate / db push working with the same
// env-var conventions, plus lets us use a separate DIRECT_URL for
// migrations on Supabase (pgbouncer's transaction-pool breaks
// migrate's session-scoped DDL).
//
// The runtime PrismaClient in lib/prisma.ts is untouched — it builds
// its own pg.Pool from DATABASE_URL via the pg adapter.

import { config as loadEnv } from 'dotenv'
import { defineConfig } from 'prisma/config'

// Prisma CLI auto-loads .env but not .env.local. Load both so commands
// run from a fresh shell don't need DATABASE_URL/DIRECT_URL exported
// manually.
loadEnv({ path: '.env.local' })
loadEnv({ path: '.env' })

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Prefer the direct (5432) connection for DDL; fall back to the
    // pooler URL when DIRECT_URL isn't set (some environments only
    // have DATABASE_URL configured).
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
    // Empty scratch DB Prisma drops/recreates to compute schema
    // deltas for `migrate diff/dev`. Local-only; never a runtime
    // URL. See docs/multi-tenancy.md for the local Postgres setup.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL ?? '',
  },
})
