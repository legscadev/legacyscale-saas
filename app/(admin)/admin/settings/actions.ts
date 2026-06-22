'use server'

import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/auth/get-user'
import { testDiscordWebhook } from '@/lib/discord'
import {
  getRawSetting,
  maskWebhookUrl,
  setSetting,
} from '@/lib/services/app-setting-service'
import { SETTING_KEYS } from '@/lib/settings/keys'
import {
  testDiscordWebhookSchema,
  updateDiscordWebhookSchema,
} from '@/lib/validations/settings'

export interface DiscordWebhookSetting {
  /** Whether a webhook URL is stored. */
  configured: boolean
  /** Masked URL for display, or null when not configured. */
  masked: string | null
}

/**
 * Load the current Discord webhook setting for the admin UI. Never
 * returns the raw URL — only a masked form. The source is the
 * `app_settings` table; there is no env-var fallback.
 */
export async function getDiscordWebhookSettingAction(): Promise<DiscordWebhookSetting> {
  await requireAdmin()
  const dbValue = await getRawSetting(SETTING_KEYS.DISCORD_WEBHOOK_URL)
  if (dbValue) {
    return { configured: true, masked: maskWebhookUrl(dbValue) }
  }
  return { configured: false, masked: null }
}

export interface SimpleResult {
  ok: boolean
  error?: string
}

/**
 * Persist (or clear) the Discord webhook URL. An empty string clears
 * the DB row so the env-var fallback resumes.
 */
export async function updateDiscordWebhookAction(
  formData: FormData,
): Promise<SimpleResult> {
  const admin = await requireAdmin()
  const parsed = updateDiscordWebhookSchema.safeParse({
    webhookUrl: formData.get('webhookUrl'),
  })
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, error: issue?.message ?? 'Invalid input' }
  }
  try {
    const next = parsed.data.webhookUrl.trim()
    await setSetting(
      SETTING_KEYS.DISCORD_WEBHOOK_URL,
      next === '' ? null : next,
      admin.id,
    )
    revalidatePath('/admin/settings')
    return { ok: true }
  } catch (err) {
    console.error('Failed to update Discord webhook setting:', err)
    return { ok: false, error: 'Could not save webhook URL' }
  }
}

/**
 * Return the raw stored webhook URL for the eye-icon reveal toggle.
 * Admin-only. Server never sends this value unsolicited — admins
 * have to explicitly request it from the UI.
 */
export async function revealDiscordWebhookAction(): Promise<
  { ok: true; url: string } | { ok: false; error: string }
> {
  await requireAdmin()
  const raw = (await getRawSetting(SETTING_KEYS.DISCORD_WEBHOOK_URL))?.trim()
  if (!raw) return { ok: false, error: 'No webhook URL configured' }
  return { ok: true, url: raw }
}

/**
 * Fire a dry-run embed to verify a webhook URL works. Admins use this
 * either against the currently saved URL (no field value) or against
 * a candidate URL they're about to save.
 */
export async function testDiscordWebhookAction(
  formData: FormData,
): Promise<SimpleResult> {
  await requireAdmin()
  const raw = formData.get('webhookUrl')
  const parsed = testDiscordWebhookSchema.safeParse({
    webhookUrl: typeof raw === 'string' && raw.trim() !== '' ? raw : undefined,
  })
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, error: issue?.message ?? 'Invalid input' }
  }
  const result = await testDiscordWebhook(parsed.data.webhookUrl)
  return result
}
