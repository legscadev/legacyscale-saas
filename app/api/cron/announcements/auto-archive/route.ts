// Cron job — archives PUBLISHED, non-archived announcements whose
// publishedAt is older than ANNOUNCEMENT_AUTO_ARCHIVE_DAYS. The
// archive defaults to a no-op when the env var is unset, so the
// platform stays opt-in.

import { NextResponse, type NextRequest } from 'next/server'

import { announcementService } from '@/lib/services/announcement-service'

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const daysRaw = process.env.ANNOUNCEMENT_AUTO_ARCHIVE_DAYS
  const days = daysRaw ? Number(daysRaw) : 0
  if (!Number.isFinite(days) || days <= 0) {
    return NextResponse.json({ ok: true, archived: 0, skipped: true })
  }
  try {
    const archived = await announcementService.autoArchiveOlderThan(days)
    return NextResponse.json({ ok: true, archived })
  } catch (err) {
    console.error('autoArchive cron failed:', err)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
