import { Megaphone, Plus } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/shared'
import { Button } from '@/components/ui/button'

export default function AdminAnnouncementsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        description="Broadcast messages to members"
      >
        <Button>
          <Plus className="h-4 w-4" />
          New Announcement
        </Button>
      </PageHeader>

      <EmptyState
        icon={Megaphone}
        title="No announcements yet"
        description="Create an announcement to communicate with your members."
      >
        <Button>
          <Plus className="h-4 w-4" />
          New Announcement
        </Button>
      </EmptyState>
    </div>
  )
}
