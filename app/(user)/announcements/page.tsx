import { Bell } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/shared'

export default function UserAnnouncementsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Announcements" description="Updates from the team" />

      <EmptyState
        icon={Bell}
        title="No announcements"
        description="Check back later for updates from the team."
      />
    </div>
  )
}
