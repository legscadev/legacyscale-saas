import { z } from 'zod'

// Hoisted Discord webhook URL pattern. Matches the runtime check in
// lib/discord.ts so the UI rejects a bad URL before it ever hits the
// service layer. Both discord.com and the legacy discordapp.com host
// are accepted, mirroring what Discord itself emits.
const DISCORD_WEBHOOK_URL_REGEX =
  /^https:\/\/discord(app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/

export const discordWebhookUrlSchema = z
  .string()
  .trim()
  .refine((v) => v === '' || DISCORD_WEBHOOK_URL_REGEX.test(v), {
    message: 'Must be a Discord webhook URL (https://discord.com/api/webhooks/…)',
  })

export const updateDiscordWebhookSchema = z.object({
  webhookUrl: discordWebhookUrlSchema,
})

export const testDiscordWebhookSchema = z.object({
  /** Optional override so admins can test a candidate URL before saving. */
  webhookUrl: discordWebhookUrlSchema.optional(),
})

export type UpdateDiscordWebhookInput = z.infer<typeof updateDiscordWebhookSchema>
export type TestDiscordWebhookInput = z.infer<typeof testDiscordWebhookSchema>
