import { notFound } from 'next/navigation'

import { requireAdmin } from '@/lib/auth/get-user'
import { announcementService } from '@/lib/services/announcement-service'
import { PageHeader } from '@/components/shared'
import { AnnouncementForm } from '@/components/admin/announcements/announcement-form'
import { updateAnnouncementAction } from '../../actions'

interface EditAnnouncementPageProps {
  params: Promise<{ id: string }>
}

export default async function EditAnnouncementPage({
  params,
}: EditAnnouncementPageProps) {
  await requireAdmin()
  const { id } = await params

  const announcement = await announcementService.getById(id)
  if (!announcement) notFound()

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit ${announcement.title}`}
        description="Changes are saved when you click Save."
      />
      <AnnouncementForm
        mode="edit"
        submitLabel="Save changes"
        defaults={{
          title: announcement.title,
          body: announcement.body,
          status: announcement.status,
          category: announcement.category,
          pinned: announcement.pinned,
          scheduledAt: announcement.scheduledAt,
        }}
        onSubmit={updateAnnouncementAction.bind(null, id)}
      />
    </div>
  )
}
