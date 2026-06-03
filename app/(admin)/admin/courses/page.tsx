import { requireAdmin } from '@/lib/auth/get-user'
import { CoursesShell } from '@/components/admin/courses/courses-shell'
import { fetchCourses } from './actions'

export default async function AdminCoursesPage() {
  await requireAdmin()
  const initialData = await fetchCourses({
    search: '',
    status: null,
    view: 'active',
    sort: 'createdAt',
    direction: 'desc',
    page: 1,
  })

  return <CoursesShell initialData={initialData} />
}
