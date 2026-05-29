import { headers } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyMuxSignature } from '@/lib/mux'

// Public webhook endpoint — self-authenticates via Mux's signed header.
// In dev, MUX_WEBHOOK_SECRET may be unset; we skip verification then so
// you can test with cURL. In production we hard-fail when the secret is
// missing.
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = (await headers()).get('mux-signature')
  const secret = process.env.MUX_WEBHOOK_SECRET

  if (secret) {
    if (!verifyMuxSignature(rawBody, signature, secret)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }
  } else if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    )
  }

  let event: MuxEvent
  try {
    event = JSON.parse(rawBody) as MuxEvent
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    await handleMuxEvent(event)
  } catch (error) {
    console.error('Mux webhook handler error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }

  return NextResponse.json({ received: true })
}

interface MuxEvent {
  type?: string
  data?: Record<string, unknown>
}

interface MuxPlaybackId {
  id?: string
}

function readString(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key]
  return typeof value === 'string' ? value : undefined
}

function readNumber(data: Record<string, unknown>, key: string): number | undefined {
  const value = data[key]
  return typeof value === 'number' ? value : undefined
}

async function handleMuxEvent(event: MuxEvent): Promise<void> {
  const data = event.data ?? {}

  switch (event.type) {
    case 'video.asset.ready': {
      const lessonId = readString(data, 'passthrough')
      if (!lessonId) return

      const assetId = readString(data, 'id')
      const duration = readNumber(data, 'duration')
      const playbackIds = data.playback_ids as MuxPlaybackId[] | undefined
      const playbackId = playbackIds?.[0]?.id

      await prisma.lesson.update({
        where: { id: lessonId },
        data: {
          muxAssetId: assetId,
          muxPlaybackId: playbackId,
          durationSeconds: Math.round(duration ?? 0),
          status: 'READY',
        },
      })
      return
    }

    case 'video.upload.asset_created': {
      const lessonId = readString(data, 'passthrough')
      if (!lessonId) return
      const assetId = readString(data, 'asset_id')

      await prisma.lesson.update({
        where: { id: lessonId },
        data: { muxAssetId: assetId, status: 'PROCESSING' },
      })
      return
    }

    case 'video.asset.errored': {
      const lessonId = readString(data, 'passthrough')
      if (!lessonId) return

      await prisma.lesson.update({
        where: { id: lessonId },
        data: { status: 'DRAFT' },
      })
      return
    }

    case 'video.asset.deleted': {
      const assetId = readString(data, 'id')
      if (!assetId) return

      await prisma.lesson.updateMany({
        where: { muxAssetId: assetId },
        data: {
          muxAssetId: null,
          muxPlaybackId: null,
          durationSeconds: null,
          status: 'DRAFT',
        },
      })
      return
    }

    default:
      // Unhandled event types are fine; Mux retries failed events.
      return
  }
}
