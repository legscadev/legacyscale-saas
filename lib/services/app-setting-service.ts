// Admin-configurable settings service.
//
// Phase 1 (white-label task 4) retargeted this service at the new
// hierarchical `settings` table. The public API surface — signatures
// + return types — is unchanged, so every caller (Discord webhook
// path, admin settings actions, announcement crosspost gate) keeps
// working without edits. Values live at PLATFORM scope for now;
// per-tenant overrides slot in later without another service rewrite.
//
// The legacy `app_settings` table is left in place during the
// transition. Reads happen from `settings`. Writes also go to
// `settings`. If a rollback is ever needed, restoring the legacy
// table's values is straightforward — they were never touched.

import { getSetting } from '@/lib/settings/get-setting'
import type { SettingKey } from '@/lib/settings/keys'
import { setPlatformSetting } from '@/lib/settings/set-setting'

/**
 * Read the raw stored value for a setting. Returns null when the key
 * is absent. SERVER ONLY — callers that surface a value to the client
 * must mask it (see `maskWebhookUrl`). Values stored here are secret-
 * equivalent (webhook URLs, API tokens) so leaking them defeats the
 * whole point of moving them out of `.env`.
 */
export async function getRawSetting(key: SettingKey): Promise<string | null> {
  const value = await getSetting<unknown>(key)
  return typeof value === 'string' ? value : null
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
    await setPlatformSetting(key, null, updatedById)
    return
  }
  await setPlatformSetting(key, normalized, updatedById)
}

/**
 * Convenience check for "is the Discord webhook configured?" — used
 * by the announcement form to disable the Crosspost checkbox when
 * there's no URL on file.
 */
export async function isDiscordWebhookConfigured(): Promise<boolean> {
  const value = await getRawSetting('discord.webhook_url')
  return Boolean(value?.trim())
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
