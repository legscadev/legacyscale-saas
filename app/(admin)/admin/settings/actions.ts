'use server'

import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/auth/get-user'
import { writeAuditLog } from '@/lib/services/audit-log-service'
import { testDiscordWebhook } from '@/lib/discord'
import {
  getRawSetting,
  maskWebhookUrl,
  setSetting,
} from '@/lib/services/app-setting-service'
import { SETTING_KEYS, type SettingKey } from '@/lib/settings/keys'
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

export interface SimpleResult {
  ok: boolean
  error?: string
}

// ============================================
// GENERIC WEBHOOK ACTIONS (parameterised by setting key)
// ============================================
//
// Two webhook channels live in app_settings: the announcement webhook
// (DISCORD_WEBHOOK_URL) and the achievements webhook
// (DISCORD_ACHIEVEMENTS_WEBHOOK_URL, ticket 6.21). Both flow through
// the same get / update / reveal / test logic — only the setting key
// differs — so the per-webhook action functions below are thin
// wrappers around these helpers.

async function getWebhookSetting(
  key: SettingKey,
): Promise<DiscordWebhookSetting> {
  await requireAdmin()
  const dbValue = await getRawSetting(key)
  if (dbValue) {
    return { configured: true, masked: maskWebhookUrl(dbValue) }
  }
  return { configured: false, masked: null }
}

async function updateWebhookSetting(
  key: SettingKey,
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
    await setSetting(key, next === '' ? null : next, admin.id)
    await writeAuditLog({
      actorId: admin.id,
      action: next === '' ? 'settings.webhook.clear' : 'settings.webhook.update',
      resourceType: 'setting',
      resourceId: key,
      summary: next === ''
        ? `Cleared webhook: ${key}`
        : `Updated webhook: ${key}`,
    })
    revalidatePath('/admin/settings')
    return { ok: true }
  } catch (err) {
    console.error(`Failed to update webhook setting ${key}:`, err)
    return { ok: false, error: 'Could not save webhook URL' }
  }
}

async function revealWebhookSetting(
  key: SettingKey,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireAdmin()
  const raw = (await getRawSetting(key))?.trim()
  if (!raw) return { ok: false, error: 'No webhook URL configured' }
  return { ok: true, url: raw }
}

async function testWebhookSetting(
  key: SettingKey,
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
  return testDiscordWebhook(parsed.data.webhookUrl, key)
}

// ============================================
// ANNOUNCEMENT WEBHOOK (existing behaviour)
// ============================================

export async function getDiscordWebhookSettingAction(): Promise<DiscordWebhookSetting> {
  return getWebhookSetting(SETTING_KEYS.DISCORD_WEBHOOK_URL)
}

export async function updateDiscordWebhookAction(
  formData: FormData,
): Promise<SimpleResult> {
  return updateWebhookSetting(SETTING_KEYS.DISCORD_WEBHOOK_URL, formData)
}

export async function revealDiscordWebhookAction(): Promise<
  { ok: true; url: string } | { ok: false; error: string }
> {
  return revealWebhookSetting(SETTING_KEYS.DISCORD_WEBHOOK_URL)
}

export async function testDiscordWebhookAction(
  formData: FormData,
): Promise<SimpleResult> {
  return testWebhookSetting(SETTING_KEYS.DISCORD_WEBHOOK_URL, formData)
}

// ============================================
// ACHIEVEMENTS WEBHOOK (Ticket 6.21)
// ============================================

export async function getAchievementsWebhookSettingAction(): Promise<DiscordWebhookSetting> {
  return getWebhookSetting(SETTING_KEYS.DISCORD_ACHIEVEMENTS_WEBHOOK_URL)
}

export async function updateAchievementsWebhookAction(
  formData: FormData,
): Promise<SimpleResult> {
  return updateWebhookSetting(
    SETTING_KEYS.DISCORD_ACHIEVEMENTS_WEBHOOK_URL,
    formData,
  )
}

export async function revealAchievementsWebhookAction(): Promise<
  { ok: true; url: string } | { ok: false; error: string }
> {
  return revealWebhookSetting(SETTING_KEYS.DISCORD_ACHIEVEMENTS_WEBHOOK_URL)
}

export async function testAchievementsWebhookAction(
  formData: FormData,
): Promise<SimpleResult> {
  return testWebhookSetting(
    SETTING_KEYS.DISCORD_ACHIEVEMENTS_WEBHOOK_URL,
    formData,
  )
}
