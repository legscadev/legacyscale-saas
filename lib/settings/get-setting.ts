// Hierarchical settings resolver.
//
// Reads from the `settings` table with USER > COMPANY > PLATFORM
// precedence. Narrower scopes override wider ones so a tenant can
// customise a value the platform ships with, and an individual user
// can further override their own view where that makes sense (UI
// prefs, notification opt-ins, etc.).
//
// Consumers typecast at the read site — `Setting.value` is JSON, so
// there's no way to guarantee `T` at the row level. Wrap this in a
// domain-specific helper if you want stronger types
// (e.g. `getDiscordWebhookUrl()` in lib/services/app-setting-service.ts).

import { prisma } from '@/lib/prisma'
import type { SettingScope } from '@prisma/client'

import { PLATFORM_SCOPE_ID } from './scope'

interface Scope {
  /** Active company id — narrows to the tenant's override, if any. */
  companyId?: string
  /** Active user id — narrows further to the user's own override. */
  userId?: string
}

/**
 * Look up a setting by key. Returns the narrowest scope's value that
 * matches the caller's context, or `null` when the key is absent at
 * every level. Cheap enough to call inline — one `findMany` with an
 * OR-of-at-most-three predicates hits the (scope, scope_id, key)
 * unique index for each branch.
 */
export async function getSetting<T = unknown>(
  key: string,
  scope: Scope = {},
): Promise<T | null> {
  const branches: { scope: SettingScope; scopeId: string }[] = [
    { scope: 'PLATFORM', scopeId: PLATFORM_SCOPE_ID },
  ]
  if (scope.companyId) branches.push({ scope: 'COMPANY', scopeId: scope.companyId })
  if (scope.userId) branches.push({ scope: 'USER', scopeId: scope.userId })

  const rows = await prisma.setting.findMany({
    where: {
      key,
      OR: branches.map((b) => ({ scope: b.scope, scopeId: b.scopeId })),
    },
    select: { scope: true, value: true },
  })
  if (rows.length === 0) return null

  const rank: Record<SettingScope, number> = { USER: 3, COMPANY: 2, PLATFORM: 1 }
  rows.sort((a, b) => rank[b.scope] - rank[a.scope])
  return rows[0].value as T
}

/**
 * Get the raw JSON value at a specific scope (no fallback). Use when
 * you need to inspect / edit a particular level — the admin settings
 * UI reads the PLATFORM row directly to render the "current stored
 * value" field, for example.
 */
export async function getSettingAtScope<T = unknown>(
  key: string,
  scope: SettingScope,
  scopeId: string,
): Promise<T | null> {
  const row = await prisma.setting.findUnique({
    where: { scope_scopeId_key: { scope, scopeId, key } },
    select: { value: true },
  })
  return (row?.value as T | undefined) ?? null
}
