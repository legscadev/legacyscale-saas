import { Bell, Sparkles } from 'lucide-react'

import { PageHeader, EmptyState, AnnouncementCard } from '@/components/shared'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { announcementService } from '@/lib/services/announcement-service'
import {
  ANNOUNCEMENT_CATEGORY_LABELS,
  type AnnouncementCategory,
} from '@/lib/validations/announcement'
import { CategoryChips } from '@/components/member/announcement-category-chips'

interface UserAnnouncementsPageProps {
  searchParams: Promise<{ category?: string }>
}

function parseCategory(raw: string | undefined): AnnouncementCategory | null {
  if (!raw) return null
  if (Object.prototype.hasOwnProperty.call(ANNOUNCEMENT_CATEGORY_LABELS, raw)) {
    return raw as AnnouncementCategory
  }
  return null
}

export default async function UserAnnouncementsPage({
  searchParams,
}: UserAnnouncementsPageProps) {
  const user = await requireActiveUser()
  const params = await searchParams
  const category = parseCategory(params.category)

  // We want a "New since your last visit" divider — capture the
  // CURRENT lastSeenAt BEFORE we bump it, so the unread items show
  // up above the divider on this render.
  const fresh = await prisma.user.findUnique({
    where: { id: user.id },
    select: { announcementsLastSeenAt: true },
  })
  const lastSeenAt = fresh?.announcementsLastSeenAt ?? null

  const announcements = await prisma.announcement.findMany({
    where: {
      status: 'PUBLISHED',
      deletedAt: null,
      archivedAt: null,
      ...(category ? { category } : {}),
    },
    orderBy: [
      { pinned: 'desc' },
      { publishedAt: 'desc' },
      { createdAt: 'desc' },
    ],
    include: {
      createdByUser: {
        select: { id: true, name: true, email: true, avatarUrl: true, role: true },
      },
      reactions: { select: { emoji: true, userId: true } },
    },
  })

  // Auto-mark as read AND bump last-seen so a re-visit doesn't keep
  // showing the divider in the same place. Both are best-effort.
  try {
    await announcementService.markAsRead(
      user.id,
      announcements.map((a) => a.id),
    )
  } catch (err) {
    console.error('markAsRead failed:', err)
  }
  try {
    await announcementService.touchAnnouncementsLastSeen(user.id)
  } catch (err) {
    console.error('touchAnnouncementsLastSeen failed:', err)
  }

  // Split into "new since last visit" and "earlier" using the
  // captured pre-bump timestamp.
  const isNew = (date: Date | null) =>
    lastSeenAt !== null && date !== null && date.getTime() > lastSeenAt.getTime()
  const newRows = announcements.filter((a) =>
    isNew(a.publishedAt ?? a.createdAt),
  )
  const earlierRows = announcements.filter(
    (a) => !isNew(a.publishedAt ?? a.createdAt),
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Announcements" description="Updates from the team" />

      <CategoryChips active={category} />

      {announcements.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No announcements"
          description={
            category
              ? 'Nothing here in this category yet.'
              : 'Check back later for updates from the team.'
          }
        />
      ) : (
        <div className="space-y-4" aria-live="polite">
          {newRows.length > 0 ? (
            <>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                <Sparkles className="size-3.5" />
                New since your last visit
              </div>
              {newRows.map((a) => (
                <AnnouncementCard
                  key={a.id}
                  href={`/announcements/${a.id}`}
                  viewerUserId={user.id}
                  announcement={{
                    id: a.id,
                    title: a.title,
                    body: a.body,
                    status: a.status,
                    category: a.category,
                    pinned: a.pinned,
                    publishedAt: a.publishedAt,
                    createdAt: a.createdAt,
                    reactions: a.reactions,
                    author: a.createdByUser
                      ? {
                          name: a.createdByUser.name,
                          email: a.createdByUser.email,
                          avatarUrl: a.createdByUser.avatarUrl,
                          role: a.createdByUser.role,
                        }
                      : null,
                  }}
                />
              ))}
              {earlierRows.length > 0 ? (
                <div className="my-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  Earlier
                  <span className="h-px flex-1 bg-border" />
                </div>
              ) : null}
            </>
          ) : null}
          {earlierRows.map((a) => (
            <AnnouncementCard
              key={a.id}
              href={`/announcements/${a.id}`}
              viewerUserId={user.id}
              announcement={{
                id: a.id,
                title: a.title,
                body: a.body,
                status: a.status,
                category: a.category,
                pinned: a.pinned,
                publishedAt: a.publishedAt,
                createdAt: a.createdAt,
                reactions: a.reactions,
                author: a.createdByUser
                  ? {
                      name: a.createdByUser.name,
                      email: a.createdByUser.email,
                      avatarUrl: a.createdByUser.avatarUrl,
                      role: a.createdByUser.role,
                    }
                  : null,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
