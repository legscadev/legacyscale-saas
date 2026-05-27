import { Bell } from 'lucide-react'
import { PageHeader, EmptyState, AnnouncementCard } from '@/components/shared'
import { prisma } from '@/lib/prisma'

export default async function UserAnnouncementsPage() {
  const announcements = await prisma.announcement.findMany({
    where: { status: 'PUBLISHED', deletedAt: null },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
  })

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
        <div className="grid gap-4 md:grid-cols-2">
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
