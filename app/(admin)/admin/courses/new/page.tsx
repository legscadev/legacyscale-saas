import type { CourseAudience } from '@prisma/client'

import { requireAdmin } from '@/lib/auth/get-user'
import { PageHeader } from '@/components/shared'
import { CourseForm } from '@/components/admin/courses/course-form'
import { membershipService } from '@/lib/services/membership-service'
import { createCourseAction } from '../actions'

const VALID_AUDIENCES: CourseAudience[] = ['MEMBERS', 'INTERNAL', 'BOTH']

interface NewCoursePageProps {
  searchParams: Promise<{ audience?: string }>
}

export default async function NewCoursePage({ searchParams }: NewCoursePageProps) {
  await requireAdmin()

  const params = await searchParams
  const requested = params.audience?.toUpperCase() as CourseAudience | undefined
  const defaultAudience: CourseAudience =
    requested && VALID_AUDIENCES.includes(requested) ? requested : 'MEMBERS'

  const isTraining = defaultAudience === 'INTERNAL'
  const memberships = await membershipService.list()

  return (
    <div className="space-y-6">
      <PageHeader
        title={isTraining ? 'New training' : 'New course'}
        description="Set up the shell here. You'll add chapters and lessons on the next screen."
      />
      <CourseForm
        mode="create"
        submitLabel={isTraining ? 'Create training' : 'Create course'}
        memberships={memberships.map((m) => ({ id: m.id, name: m.name }))}
        onSubmit={createCourseAction}
        defaults={{ audience: defaultAudience }}
      />
    </div>
  )
}
