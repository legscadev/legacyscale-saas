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

import { getSettingAtScope } from '@/lib/settings/get-setting'
import type { SettingKey } from '@/lib/settings/keys'
import { setScopedSetting } from '@/lib/settings/set-setting'
import { getRequestCompanyId } from '@/lib/tenancy/request-company'

/**
 * Read the raw stored value for a setting, always at the caller's
 * active-company scope. Returns null when the key is absent OR when
 * there's no active company (server jobs / seed scripts) — the
 * latter is intentional so we never leak one tenant's secret to
 * another by falling back to a platform-wide row.
 *
 * Values here are secret-equivalent (webhook URLs, API tokens); the
 * previous PLATFORM-fallback behavior meant every tenant that hadn't
 * configured Discord read the platform's URL. That's the tenancy leak
 * the switch to COMPANY-only scope closes.
 */
export async function getRawSetting(key: SettingKey): Promise<string | null> {
  const companyId = await getRequestCompanyId()
  if (!companyId) return null
  const value = await getSettingAtScope<unknown>(key, 'COMPANY', companyId)
  return typeof value === 'string' ? value : null
}

/**
 * Upsert a setting at the caller's active-company scope. Passing
 * `null` (or an empty string) deletes the row for that tenant. Throws
 * when there's no active company — the settings surface should never
 * try to save outside a tenant context.
 */
export async function setSetting(
  key: SettingKey,
  value: string | null,
  updatedById: string,
): Promise<void> {
  const companyId = await getRequestCompanyId()
  if (!companyId) {
    throw new Error('setSetting: no active company on the request')
  }
  const normalized = value?.trim() ?? ''
  await setScopedSetting(
    'COMPANY',
    companyId,
    key,
    normalized === '' ? null : normalized,
    updatedById,
  )
}

/**
 * Convenience check for "is the Discord webhook configured?" — used
 * by the announcement form to disable the Crosspost checkbox when
 * there's no URL on file for the current tenant.
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
