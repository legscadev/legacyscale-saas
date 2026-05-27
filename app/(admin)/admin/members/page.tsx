import { Plus, Users } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/shared'
import { Button } from '@/components/ui/button'

export default function AdminMembersPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Members" description="Manage platform members">
        <Button>
          <Plus className="h-4 w-4" />
          Add Member
        </Button>
      </PageHeader>

      <EmptyState
        icon={Users}
        title="No members yet"
        description="Members will appear here once they join the platform."
      />
    </div>
  )
}
