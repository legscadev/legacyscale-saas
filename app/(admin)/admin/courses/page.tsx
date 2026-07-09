import { requireAdmin } from '@/lib/auth/get-user'
import { CoursesShell } from '@/components/admin/courses/courses-shell'
import { fetchCourses } from './actions'

export default async function AdminCoursesPage() {
  await requireAdmin()
  // Courses lens: everything member-facing (MEMBERS + BOTH). Internal-
  // only courses live under /admin/trainings and don't leak into
  // this list.
  const initialData = await fetchCourses({
    search: '',
    status: null,
    view: 'active',
    audiences: ['MEMBERS', 'BOTH'],
    sort: 'createdAt',
    direction: 'desc',
    page: 1,
  })

  return (
    <CoursesShell
      initialData={initialData}
      audiences={['MEMBERS', 'BOTH']}
    />
  )
}
