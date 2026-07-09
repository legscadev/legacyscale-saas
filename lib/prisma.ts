import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

import { tenancyExtension } from './tenancy/prisma-extension'

// The extended client's type is derived from $extends; export as
// unknown-cast PrismaClient so existing service imports keep their
// existing types. All tenancy work happens inside the extension
// (see lib/tenancy/prisma-extension.ts) — no service call sites
// need to change.
type PrismaClientLike = ReturnType<typeof createPrismaClient>

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientLike | undefined
}

function createPrismaClient() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  })
  const adapter = new PrismaPg(pool)
  const base = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
  return base.$extends(tenancyExtension())
}

export const prisma = (globalForPrisma.prisma ??
  createPrismaClient()) as unknown as PrismaClient

if (process.env.NODE_ENV !== 'production')
  globalForPrisma.prisma = prisma as unknown as PrismaClientLike

export default prisma
