// prisma/backfill-modules.ts
//
// One-time backfill: for every course that has chapters with NULL
// module_id, create a "General" module on that course and move those
// chapters into it. Idempotent — re-running is a no-op once every
// course has been processed.
//
// Usage:
//   pnpm tsx prisma/backfill-modules.ts
//
// Safe to run on a DB that already has some courses with modules;
// it only touches loose chapters (module_id IS NULL).

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { config } from 'dotenv'

config({ path: '.env.local' })

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const DEFAULT_MODULE_TITLE = 'General'

async function backfill() {
  const courseIds = await findCoursesWithLooseChapters()

  if (courseIds.length === 0) {
    console.log('✅ Nothing to backfill — every chapter is already in a module.')
    return
  }

  console.log(`📦 Backfilling ${courseIds.length} course(s)...`)

  for (const courseId of courseIds) {
    await backfillCourse(courseId)
  }

  console.log('✅ Backfill complete.')
}

async function findCoursesWithLooseChapters(): Promise<string[]> {
  const rows = await prisma.chapter.findMany({
    where: { moduleId: null, deletedAt: null },
    select: { courseId: true },
    distinct: ['courseId'],
  })
  return rows.map((r) => r.courseId)
}

async function backfillCourse(courseId: string) {
  await prisma.$transaction(async (tx) => {
    const looseChapters = await tx.chapter.findMany({
      where: { courseId, moduleId: null, deletedAt: null },
      select: { id: true, orderIndex: true },
      orderBy: { orderIndex: 'asc' },
    })

    if (looseChapters.length === 0) return

    // Place the new module at the lowest orderIndex among the loose
    // chapters so it sits where they used to be in the course list.
    const moduleOrderIndex = looseChapters[0].orderIndex

    const moduleRow = await tx.module.create({
      data: {
        courseId,
        title: DEFAULT_MODULE_TITLE,
        orderIndex: moduleOrderIndex,
      },
      select: { id: true },
    })

    await tx.chapter.updateMany({
      where: { id: { in: looseChapters.map((c) => c.id) } },
      data: { moduleId: moduleRow.id },
    })

    console.log(
      `  • Course ${courseId}: moved ${looseChapters.length} chapter(s) into module ${moduleRow.id}`
    )
  })
}

backfill()
  .catch((err) => {
    console.error('❌ Backfill failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
