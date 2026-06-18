import { requireAdmin } from '@/lib/auth/get-user'
import { PageHeader } from '@/components/shared'
import { AnnouncementForm } from '@/components/admin/announcements/announcement-form'
import { createAnnouncementAction } from '../actions'

export default async function NewAnnouncementPage() {
  await requireAdmin()
  return (
    <div className="space-y-6">
      <PageHeader
        title="New announcement"
        description="Drafts stay admin-only until you publish."
      />
      <AnnouncementForm
        mode="create"
        submitLabel="Create announcement"
        onSubmit={createAnnouncementAction}
      />
    </div>
  )
}
