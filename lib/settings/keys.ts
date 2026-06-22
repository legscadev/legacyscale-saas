// Source of truth for keys in the `app_settings` table. Lookups go
// through these constants so a typo in a string literal can't silently
// resolve to "not configured". Add a key here when introducing a new
// admin-managed setting.

export const SETTING_KEYS = {
  DISCORD_WEBHOOK_URL: 'discord.webhook_url',
} as const

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS]
