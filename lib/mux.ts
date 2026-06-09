import Mux from '@mux/mux-node'
import crypto from 'node:crypto'

// Lazy singleton — only throws on first use, not at import time.
// This lets `next build` succeed even if Mux credentials aren't set.
let _mux: Mux | null = null

function getMux(): Mux {
  if (_mux) return _mux
  const tokenId = process.env.MUX_TOKEN_ID
  const tokenSecret = process.env.MUX_TOKEN_SECRET
  if (!tokenId || !tokenSecret) {
    throw new Error(
      'Missing Mux credentials: set MUX_TOKEN_ID and MUX_TOKEN_SECRET'
    )
  }
  _mux = new Mux({ tokenId, tokenSecret })
  return _mux
}

// ============================================
// UPLOADS
// ============================================

interface CreateUploadOptions {
  /** Restrict the browser origin allowed to PUT to the upload URL. */
  corsOrigin?: string
  /** Echoed back in webhooks — we use it to map the asset to a lesson id. */
  passthrough?: string
  playbackPolicy?: ('public' | 'signed')[]
}

export async function createDirectUpload(options: CreateUploadOptions = {}) {
  const mux = getMux()
  const upload = await mux.video.uploads.create({
    cors_origin: options.corsOrigin ?? '*',
    new_asset_settings: {
      playback_policy: options.playbackPolicy ?? ['public'],
      passthrough: options.passthrough,
    },
  })
  return { uploadId: upload.id, uploadUrl: upload.url }
}

export async function createAssetFromUrl(url: string, passthrough?: string) {
  const mux = getMux()
  const asset = await mux.video.assets.create({
    inputs: [{ url }],
    playback_policy: ['public'],
    passthrough,
  })
  return {
    assetId: asset.id,
    playbackId: asset.playback_ids?.[0]?.id,
    status: asset.status,
  }
}

// ============================================
// ASSETS
// ============================================

export async function getAsset(assetId: string) {
  const mux = getMux()
  const asset = await mux.video.assets.retrieve(assetId)
  return {
    id: asset.id,
    status: asset.status,
    playbackId: asset.playback_ids?.[0]?.id,
    duration: asset.duration,
    aspectRatio: asset.aspect_ratio,
    resolution: asset.resolution_tier,
    createdAt: asset.created_at,
  }
}

export async function deleteAsset(assetId: string): Promise<void> {
  const mux = getMux()
  await mux.video.assets.delete(assetId)
}

export async function getUploadStatus(uploadId: string) {
  const mux = getMux()
  const upload = await mux.video.uploads.retrieve(uploadId)
  return {
    id: upload.id,
    status: upload.status,
    assetId: upload.asset_id,
  }
}

// ============================================
// PLAYBACK URLS (no SDK call — deterministic Mux endpoints)
// ============================================

export function getPlaybackUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`
}

interface ThumbnailOptions {
  width?: number
  height?: number
  time?: number
  fitMode?: 'preserve' | 'stretch' | 'crop' | 'smartcrop' | 'pad'
}

export function getThumbnailUrl(
  playbackId: string,
  options: ThumbnailOptions = {}
): string {
  const params = new URLSearchParams({
    width: String(options.width ?? 640),
    height: String(options.height ?? 360),
    time: String(options.time ?? 0),
    fit_mode: options.fitMode ?? 'smartcrop',
  })
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?${params}`
}

interface GifOptions {
  width?: number
  fps?: number
  start?: number
  end?: number
}

export function getGifUrl(playbackId: string, options: GifOptions = {}): string {
  const params = new URLSearchParams({
    width: String(options.width ?? 320),
    fps: String(options.fps ?? 15),
    start: String(options.start ?? 0),
    end: String(options.end ?? 5),
  })
  return `https://image.mux.com/${playbackId}/animated.gif?${params}`
}

export function getStoryboardUrl(playbackId: string): string {
  return `https://image.mux.com/${playbackId}/storyboard.vtt`
}

// ============================================
// WEBHOOK SIGNATURE VERIFICATION
// ============================================
//
// Mux sends `Mux-Signature: t=<unix-ts>,v1=<sha256-hex>`. The signed
// payload is `<timestamp>.<rawBody>`. We also enforce a tolerance window
// for replay protection.

export function verifyMuxSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  toleranceSeconds = 300
): boolean {
  if (!signatureHeader) return false

  const parts: Record<string, string> = {}
  for (const pair of signatureHeader.split(',')) {
    const [k, v] = pair.split('=')
    if (k && v) parts[k.trim()] = v.trim()
  }

  const timestamp = parts.t
  const signature = parts.v1
  if (!timestamp || !signature) return false

  const tsSec = Number(timestamp)
  if (!Number.isFinite(tsSec)) return false
  const nowSec = Math.floor(Date.now() / 1000)
  if (Math.abs(nowSec - tsSec) > toleranceSeconds) return false

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex')

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    )
  } catch {
    return false
  }
}

// ============================================
// TYPES
// ============================================

export type MuxAssetStatus = 'preparing' | 'ready' | 'errored'
export type MuxUploadStatus =
  | 'waiting'
  | 'asset_created'
  | 'errored'
  | 'cancelled'
  | 'timed_out'
