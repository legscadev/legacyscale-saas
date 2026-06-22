// Cron job — flips every SCHEDULED announcement whose scheduledAt
// has come due to PUBLISHED. Scheduled by vercel.json. Authenticated
// via the Vercel Cron Authorization header.
//
// Reference: https://vercel.com/docs/cron-jobs/manage-cron-jobs

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
  try {
    const result = await announcementService.publishDueScheduled()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('publishDueScheduled cron failed:', err)
    return NextResponse.json(
      { error: 'Cron failed' },
      { status: 500 },
    )
  }
}
