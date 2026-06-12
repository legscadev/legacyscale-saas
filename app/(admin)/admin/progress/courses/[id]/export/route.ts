import { NextResponse, type NextRequest } from 'next/server'

import { requireAdmin } from '@/lib/auth/get-user'
import { prisma } from '@/lib/prisma'
import { adminProgressService } from '@/lib/services/admin-progress-service'

interface Context {
  params: Promise<{ id: string }>
}

/**
 * CSV export of the cohort visible on /admin/progress/courses/[id].
 * Reuses the exact same where-clause as the paginated view, so the
 * download always matches what the operator is seeing on screen.
 */
export async function GET(request: NextRequest, { params }: Context) {
  await requireAdmin()
  const { id } = await params

  // Sanity-check the course exists so we 404 cleanly instead of
  // returning an empty CSV against a bad id.
  const course = await prisma.course.findUnique({
    where: { id, deletedAt: null },
    select: { title: true },
  })
  if (!course) {
    return NextResponse.json(
      { error: 'Course not found' },
      { status: 404 },
    )
  }

  const sp = request.nextUrl.searchParams
  const search = sp.get('search') ?? ''
  const roleParam = sp.get('role')
  const statusParam = sp.get('status')
  const sortParam = sp.get('sort')

  const role: 'ALL' | 'MEMBER' | 'TEAM' =
    roleParam === 'MEMBER' || roleParam === 'TEAM' ? roleParam : 'ALL'
  const status: 'ALL' | 'ACTIVE' | 'COMPLETED' | 'EXPIRED' =
    statusParam === 'ACTIVE' ||
    statusParam === 'COMPLETED' ||
    statusParam === 'EXPIRED'
      ? statusParam
      : 'ALL'
  const sort: 'progress' | 'enrolled' | 'lastAccess' | 'name' =
    sortParam === 'enrolled' ||
    sortParam === 'lastAccess' ||
    sortParam === 'name'
      ? sortParam
      : 'progress'

  const csv = await adminProgressService.exportCourseCohortCsv(
    id,
    { search, role, status },
    sort,
  )

  // Filename: slug of course title + date stamp.
  const slug = course.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'course'
  const stamp = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const filename = `${slug}-cohort-${stamp}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
