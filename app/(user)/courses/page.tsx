import { BookOpen } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/shared'

export default function UserCoursesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="My Courses" description="Continue where you left off" />

      <EmptyState
        icon={BookOpen}
        title="No courses yet"
        description="Courses you're enrolled in will appear here."
      />
    </div>
  )
}
