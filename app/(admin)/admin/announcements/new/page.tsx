import { requireAdmin } from '@/lib/auth/get-user'
import { isDiscordWebhookConfigured } from '@/lib/services/app-setting-service'
import { PageHeader } from '@/components/shared'
import { AnnouncementForm } from '@/components/admin/announcements/announcement-form'
import { createAnnouncementAction } from '../actions'

export default async function NewAnnouncementPage() {
  await requireAdmin()
  const discordWebhookConfigured = await isDiscordWebhookConfigured()
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
        discordWebhookConfigured={discordWebhookConfigured}
      />
    </div>
  )
}
