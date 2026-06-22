// Thin wrapper around Discord's webhook API. We use it to crosspost
// announcements (and could reuse it for any future broadcast). All
// transport-level concerns (URL config, mention behaviour, timeout,
// payload shape) live here so callers stay focused on *what* they
// want to post.
//
// Discord docs:
//   https://discord.com/developers/docs/resources/webhook#execute-webhook
//
// SAFETY: @everyone requires the webhook to have the "Mention
// @everyone, @here, and All Roles" permission on the Discord server.
// If that's off, the literal text "@everyone" still posts but won't
// notify anyone.

import { getRawSetting } from '@/lib/services/app-setting-service'
import { SETTING_KEYS } from '@/lib/settings/keys'

interface DiscordEmbed {
  title?: string
  description?: string
  url?: string
  color?: number
  timestamp?: string
  footer?: { text: string }
}

interface ExecuteWebhookPayload {
  content?: string
  embeds?: DiscordEmbed[]
  allowed_mentions?: {
    parse?: Array<'everyone' | 'here' | 'roles' | 'users'>
  }
  username?: string
  avatar_url?: string
}

const DISCORD_WEBHOOK_TIMEOUT_MS = 10_000
const KONDENSE_BRAND_RED = 0xd11a1a

// Webhook URL lives in the `app_settings` table; admins set it via
// /admin/settings → Integrations. No env-var fallback — if the row is
// missing, callers no-op silently. Returning null is the "no webhook
// configured" signal.
async function resolveWebhookUrl(): Promise<string | null> {
  const raw = await getRawSetting(SETTING_KEYS.DISCORD_WEBHOOK_URL).catch(
    (err) => {
      console.error('Failed to read Discord webhook setting from DB:', err)
      return null
    },
  )
  const trimmed = raw?.trim()
  if (!trimmed) return null
  if (!/^https:\/\/discord(app)?\.com\/api\/webhooks\//.test(trimmed)) {
    console.error('Stored Discord webhook URL does not look like a webhook URL')
    return null
  }
  return trimmed
}

async function executeWebhook(
  payload: ExecuteWebhookPayload,
  overrideUrl?: string,
): Promise<void> {
  const url = overrideUrl ?? (await resolveWebhookUrl())
  if (!url) {
    // No webhook configured — silently no-op so the caller doesn't
    // have to gate every call site.
    return
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DISCORD_WEBHOOK_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '<no body>')
      console.error(
        `Discord webhook returned ${res.status}: ${body.slice(0, 400)}`,
      )
    }
  } catch (err) {
    console.error('Discord webhook execution failed:', err)
  } finally {
    clearTimeout(timer)
  }
}

interface AnnouncementCrossPostInput {
  title: string
  /** Plain text. Already HTML-stripped. */
  bodyPreview: string
  viewUrl: string
  /** When true, include `@everyone` in the post and parse it as a mention. */
  mentionEveryone?: boolean
}

const BODY_PREVIEW_DISCORD_MAX = 800

export async function postAnnouncementToDiscord(
  input: AnnouncementCrossPostInput,
): Promise<void> {
  const trimmedPreview =
    input.bodyPreview.length > BODY_PREVIEW_DISCORD_MAX
      ? input.bodyPreview.slice(0, BODY_PREVIEW_DISCORD_MAX - 1) + '…'
      : input.bodyPreview

  await executeWebhook({
    content: input.mentionEveryone ? '@everyone' : undefined,
    embeds: [
      {
        title: input.title,
        description: trimmedPreview || undefined,
        url: input.viewUrl,
        color: KONDENSE_BRAND_RED,
        timestamp: new Date().toISOString(),
        footer: { text: 'Kondense' },
      },
    ],
    allowed_mentions: input.mentionEveryone
      ? { parse: ['everyone'] }
      : { parse: [] },
  })
}

/**
 * Post a dry-run embed to verify a webhook URL works. Unlike
 * `postAnnouncementToDiscord` (which swallows errors so a broken
 * webhook can't block publishing), this surfaces failures so the
 * admin UI can show a clear error toast.
 *
 * `overrideUrl` lets admins test a *candidate* URL before saving it.
 * When omitted, falls back to the currently resolved URL (DB → env).
 */
export async function testDiscordWebhook(
  overrideUrl?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = overrideUrl?.trim() || (await resolveWebhookUrl())
  if (!url) {
    return { ok: false, error: 'No Discord webhook URL configured' }
  }
  if (!/^https:\/\/discord(app)?\.com\/api\/webhooks\//.test(url)) {
    return { ok: false, error: 'Not a valid Discord webhook URL' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DISCORD_WEBHOOK_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title: 'Kondense webhook test',
            description:
              'This is a test message from the admin settings page. If you see this, the webhook is wired up correctly.',
            color: KONDENSE_BRAND_RED,
            timestamp: new Date().toISOString(),
            footer: { text: 'Kondense · test' },
          },
        ],
        allowed_mentions: { parse: [] },
      } satisfies ExecuteWebhookPayload),
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '<no body>')
      return {
        ok: false,
        error: `Discord returned ${res.status} ${res.statusText}: ${body.slice(0, 200)}`,
      }
    }
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: message }
  } finally {
    clearTimeout(timer)
  }
}
