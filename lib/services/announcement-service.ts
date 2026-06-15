import { unstable_cache } from 'next/cache'

import { prisma } from '@/lib/prisma'
import { PROGRESS_TAG } from '@/lib/services/admin-progress-service'

// Member-facing read for the /announcements page. Same payload for
// every member, so it caches well behind a single entry. Admin writes
// (when they exist) should call updateTag(PROGRESS_TAG) — for now the
// 60s TTL is the only invalidation source.

const ANNOUNCEMENTS_TTL_SECONDS = 60

async function _listPublishedAnnouncementsImpl() {
  return prisma.announcement.findMany({
    where: { status: 'PUBLISHED', deletedAt: null },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
  })
}

const cachedListPublishedAnnouncements = unstable_cache(
  _listPublishedAnnouncementsImpl,
  ['announcement:listPublished'],
  { revalidate: ANNOUNCEMENTS_TTL_SECONDS, tags: [PROGRESS_TAG] },
)

export async function listPublishedAnnouncements() {
  return cachedListPublishedAnnouncements()
}

export const announcementService = {
  listPublished: listPublishedAnnouncements,
}
