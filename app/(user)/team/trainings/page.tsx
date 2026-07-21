import { redirect } from 'next/navigation'

import { requireTeamModuleAccess } from '@/lib/auth/get-user'
import { CoursesShell } from '@/components/admin/courses/courses-shell'
import { fetchCourses } from '@/app/(admin)/admin/courses/actions'

// TEAM-side wrapper for Trainings (internal-audience courses).
// ADMIN gets bounced to /admin/trainings.

export default async function TeamTrainingsPage() {
  const viewer = await requireTeamModuleAccess('trainings')
  if (viewer.role === 'ADMIN') redirect('/admin/trainings')

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
