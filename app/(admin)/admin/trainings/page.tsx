import { requireTeamModuleAccess } from '@/lib/auth/get-user'
import { CoursesShell } from '@/components/admin/courses/courses-shell'
import { fetchCourses } from '../courses/actions'

export default async function AdminTrainingsPage() {
  await requireTeamModuleAccess('trainings')
  // Trainings lens: internal-audience courses only (INTERNAL + BOTH).
  // Same data model as Courses, purpose-locked so admin + team can
  // learn without sharing the surface with student content.
  const initialData = await fetchCourses({
    search: '',
    status: null,
    view: 'active',
    audiences: ['INTERNAL', 'BOTH'],
    sort: 'createdAt',
    direction: 'desc',
    page: 1,
  })

  return (
    <CoursesShell
      initialData={initialData}
      audiences={['INTERNAL', 'BOTH']}
      pageTitle="Trainings"
      pageDescription={
        initialData.counts.all === 1
          ? 'Manage 1 training for the internal team.'
          : `Manage ${initialData.counts.all.toLocaleString()} trainings for the internal team.`
      }
      createLabel="Create training"
      createHref="/admin/courses/new?audience=INTERNAL"
      emptyTitle="No trainings yet"
      emptyDescription="Create your first training for admins and internal team members."
      noun={{ singular: 'training', plural: 'trainings' }}
    />
  )
}
