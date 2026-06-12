import { NextResponse, type NextRequest } from 'next/server'

import { requireAdmin } from '@/lib/auth/get-user'
import { adminProgressService } from '@/lib/services/admin-progress-service'

/**
 * CSV export of the members list visible on /admin/progress/members.
 * Reuses the same filter + sort logic as the page so the download
 * matches the on-screen list. Capped at CSV_EXPORT_MAX_ROWS rows;
 * truncation marker is appended by the service layer.
 */
export async function GET(request: NextRequest) {
  await requireAdmin()

  const sp = request.nextUrl.searchParams
  const search = sp.get('search') ?? ''
  const roleParam = sp.get('role')
  const sortParam = sp.get('sort')

  const role: 'ALL' | 'MEMBER' | 'TEAM' =
    roleParam === 'MEMBER' || roleParam === 'TEAM' ? roleParam : 'ALL'
  const sort: 'recent' | 'progress' | 'enrollments' | 'name' =
    sortParam === 'progress' ||
    sortParam === 'enrollments' ||
    sortParam === 'name'
      ? sortParam
      : 'recent'

  const csv = await adminProgressService.exportMembersCsv(
    { search, role },
    sort,
  )

  const stamp = new Date().toISOString().slice(0, 10)
  const filename = `members-progress-${stamp}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
