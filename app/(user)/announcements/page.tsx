import { Bell } from 'lucide-react'
import { PageHeader, EmptyState, AnnouncementCard } from '@/components/shared'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { announcementService } from '@/lib/services/announcement-service'

export default async function UserAnnouncementsPage() {
  const user = await requireActiveUser()
  const announcements = await prisma.announcement.findMany({
    where: { status: 'PUBLISHED', deletedAt: null },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
  })
  // Auto-mark every announcement on this page as read — the cards
  // show the full body inline so a page visit IS the read event.
  // Best-effort: skipDuplicates handles re-visits, and a failure
  // here shouldn't blank the page.
  try {
    await announcementService.markAsRead(
      user.id,
      announcements.map((a) => a.id),
    )
  } catch (err) {
    console.error('markAsRead failed:', err)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Announcements" description="Updates from the team" />

      {announcements.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No announcements"
          description="Check back later for updates from the team."
        />
      ) : (
        <div className="mx-auto max-w-2xl space-y-4">
          {announcements.map((announcement) => (
            <AnnouncementCard
              key={announcement.id}
              announcement={{
                id: announcement.id,
                title: announcement.title,
                body: announcement.body,
                status: announcement.status,
                publishedAt: announcement.publishedAt,
                createdAt: announcement.createdAt,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
