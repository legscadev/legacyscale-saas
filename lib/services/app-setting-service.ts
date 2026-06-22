import { prisma } from '@/lib/prisma'
import type { SettingKey } from '@/lib/settings/keys'

/**
 * Read the raw stored value for a setting. Returns null when the key
 * is absent. SERVER ONLY — callers that surface a value to the client
 * must mask it (see `maskWebhookUrl`). Values stored here are secret-
 * equivalent (webhook URLs, API tokens) so leaking them defeats the
 * whole point of moving them out of `.env`.
 */
export async function getRawSetting(key: SettingKey): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({
    where: { key },
    select: { value: true },
  })
  return row?.value ?? null
}

/**
 * Upsert a setting. Passing `null` (or an empty string) clears the row
 * so the env-var fallback resumes. `updatedById` records who made the
 * change for lightweight audit.
 */
export async function setSetting(
  key: SettingKey,
  value: string | null,
  updatedById: string,
): Promise<void> {
  const normalized = value?.trim() ?? ''
  if (normalized === '') {
    await prisma.appSetting.deleteMany({ where: { key } })
    return
  }
  await prisma.appSetting.upsert({
    where: { key },
    update: { value: normalized, updatedById },
    create: { key, value: normalized, updatedById },
  })
}

/**
 * Convenience check for "is the Discord webhook configured?" — used
 * by the announcement form to disable the Crosspost checkbox when
 * there's no URL on file. Stays in this service so callers don't
 * need to import the SETTING_KEYS constant just for one lookup.
 */
export async function isDiscordWebhookConfigured(): Promise<boolean> {
  const value = await prisma.appSetting.findUnique({
    where: { key: 'discord.webhook_url' },
    select: { value: true },
  })
  return Boolean(value?.value?.trim())
}

/**
 * Mask a Discord webhook URL for client display. Preserves enough of
 * the URL (host + id) for an admin to recognise which webhook is
 * stored, while hiding the secret token portion.
 *
 *   https://discord.com/api/webhooks/123/abcXYZ → https://discord.com/api/webhooks/123/****
 */
export function maskWebhookUrl(url: string): string {
  const match = url.match(
    /^(https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+)\/[\w-]+$/,
  )
  if (!match) return '****'
  return `${match[1]}/****`
}
