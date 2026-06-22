import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { AnnouncementCard } from '@/components/shared'
import { CommentsSection } from '@/components/member/announcement-comments'
import { requireActiveUser } from '@/lib/auth'
import { announcementService } from '@/lib/services/announcement-service'

interface AnnouncementDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function AnnouncementDetailPage({
  params,
}: AnnouncementDetailPageProps) {
  const user = await requireActiveUser()
  const { id } = await params

  const announcement = await announcementService.getById(id)
  if (!announcement || announcement.status !== 'PUBLISHED') notFound()

  // Visiting the permalink IS the read event for THIS one row.
  try {
    await announcementService.markAsRead(user.id, [announcement.id])
  } catch (err) {
    console.error('markAsRead (detail) failed:', err)
  }

  const comments = await announcementService.listComments(announcement.id)

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2"
        render={<Link href="/announcements" />}
      >
        <ArrowLeft className="size-4" />
        Back to announcements
      </Button>

      <AnnouncementCard
        viewerUserId={user.id}
        announcement={{
          id: announcement.id,
          title: announcement.title,
          body: announcement.body,
          status: announcement.status,
          category: announcement.category,
          pinned: announcement.pinned,
          publishedAt: announcement.publishedAt,
          createdAt: announcement.createdAt,
          reactions: announcement.reactions,
          author: announcement.createdByUser
            ? {
                name: announcement.createdByUser.name,
                email: announcement.createdByUser.email,
                avatarUrl: announcement.createdByUser.avatarUrl,
                role: announcement.createdByUser.role,
              }
            : null,
        }}
      />

      <CommentsSection
        announcementId={announcement.id}
        comments={comments}
        viewerUserId={user.id}
        viewerRole={user.role}
      />
    </div>
  )
}
