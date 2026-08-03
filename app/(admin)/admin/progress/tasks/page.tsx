// Global admin view of every student's personal tasks + goals across
// the tenant. Filters are URL-driven so a link to
// /admin/student-tasks?overdue=1 (from the dashboard widget or a
// per-student page) lands with the right slice pre-applied.

import { requireTeamModuleAccess } from '@/lib/auth/get-user'
import { adminStudentTaskService } from '@/lib/services/admin-student-task-service'
import { StudentTasksShell } from '@/components/admin/student-tasks/student-tasks-shell'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{
    studentId?: string
    overdue?: string
    completed?: string
    page?: string
  }>
}

function parsePage(raw: string | undefined): number {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1
}

export default async function AdminStudentTasksPage({
  searchParams,
}: PageProps) {
  await requireTeamModuleAccess('students')
  const sp = await searchParams

  const filters = {
    studentId: sp.studentId?.trim() || null,
    overdueOnly: sp.overdue === '1',
    includeCompleted: sp.completed === '1',
    page: parsePage(sp.page),
    limit: 50,
  }

  const [result, students] = await Promise.all([
    adminStudentTaskService.list(filters),
    adminStudentTaskService.listStudentsWithTasks(),
  ])

  return (
    <StudentTasksShell
      result={result}
      students={students}
      filters={{
        studentId: filters.studentId,
        overdueOnly: filters.overdueOnly,
        includeCompleted: filters.includeCompleted,
      }}
    />
  )
}
