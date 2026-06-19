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

function getWebhookUrl(): string | null {
  const url = process.env.DISCORD_WEBHOOK_URL?.trim()
  if (!url) return null
  // Bare-bones safety: must be a Discord webhook URL.
  if (!/^https:\/\/discord(app)?\.com\/api\/webhooks\//.test(url)) {
    console.error('DISCORD_WEBHOOK_URL is set but does not look like a Discord webhook URL')
    return null
  }
  return url
}

async function executeWebhook(payload: ExecuteWebhookPayload): Promise<void> {
  const url = getWebhookUrl()
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
