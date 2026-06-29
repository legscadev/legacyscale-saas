import 'server-only'

import { headers } from 'next/headers'

import { prisma } from '@/lib/prisma'

export interface RateLimitOptions {
  /** Action key — e.g. "auth:sign-in". Scopes the counter per flow. */
  action: string
  /** Window length in seconds. Counters reset at window boundaries. */
  windowSec: number
  /** Maximum requests allowed per IP per window. */
  max: number
}

export interface RateLimitResult {
  /** True when the request is under the limit. False = block. */
  ok: boolean
  /** Requests remaining in the current window (0 once blocked). */
  remaining: number
  /** Seconds until the current window resets. Useful for Retry-After. */
  retryAfter: number
}

/**
 * Read the client IP from the inbound request. On Vercel, the leftmost
 * value of `x-forwarded-for` is the real client. Falls back to
 * `x-real-ip` and finally a sentinel so an unknown IP still counts
 * against a shared bucket rather than escaping the limit entirely.
 */
async function clientIp(): Promise<string> {
  const h = await headers()
  const xff = h.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  return h.get('x-real-ip') ?? 'unknown'
}

/** Floor `now` to the start of its fixed window. */
function bucketStart(windowSec: number, now: Date = new Date()): Date {
  const ms = windowSec * 1000
  return new Date(Math.floor(now.getTime() / ms) * ms)
}

/**
 * Check + increment the per-IP counter for `action` within the current
 * fixed window. Atomic via Prisma upsert. If the request would exceed
 * the configured limit, the counter still increments (so repeated
 * bursts don't reset on the deny edge) — callers can rely on `ok`
 * alone to decide.
 *
 * On any database error this fails OPEN — better to serve the request
 * than to take auth flows down because the counter is unhealthy.
 * Errors are logged for monitoring.
 */
export async function checkRateLimit(
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const { action, windowSec, max } = options
  const ip = await clientIp()
  const windowStart = bucketStart(windowSec)
  const nowMs = Date.now()
  const windowEndMs = windowStart.getTime() + windowSec * 1000
  const retryAfter = Math.max(0, Math.ceil((windowEndMs - nowMs) / 1000))

  try {
    const row = await prisma.rateLimit.upsert({
      where: {
        ip_action_windowStart: { ip, action, windowStart },
      },
      create: { ip, action, windowStart, count: 1 },
      update: { count: { increment: 1 } },
      select: { count: true },
    })
    const remaining = Math.max(0, max - row.count)
    return { ok: row.count <= max, remaining, retryAfter }
  } catch (err) {
    console.error('[rate-limit] failed, allowing request:', err)
    return { ok: true, remaining: max, retryAfter }
  }
}

/**
 * Sugar for the common server-action / route case: throw a labelled
 * error when the limit is exceeded. Callers translate it into the
 * appropriate response shape (form action state, JSON 429, etc.).
 */
export class RateLimitError extends Error {
  constructor(public readonly retryAfter: number) {
    super('Too many requests, please try again later.')
    this.name = 'RateLimitError'
  }
}

export async function enforceRateLimit(
  options: RateLimitOptions,
): Promise<void> {
  const result = await checkRateLimit(options)
  if (!result.ok) {
    throw new RateLimitError(result.retryAfter)
  }
}
