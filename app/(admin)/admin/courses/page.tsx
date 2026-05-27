import { GraduationCap, Plus } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/shared'
import { Button } from '@/components/ui/button'

export default function AdminCoursesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Courses" description="Manage your course content">
        <Button>
          <Plus className="h-4 w-4" />
          Create Course
        </Button>
      </PageHeader>

      <EmptyState
        icon={GraduationCap}
        title="No courses yet"
        description="Create your first course to get started."
      >
        <Button>
          <Plus className="h-4 w-4" />
          Create Course
        </Button>
      </EmptyState>
    </div>
  )
}
