// Writes to the hierarchical `settings` table.
//
// One upsert per (scope, scope_id, key). Callers own the semantics
// of "clearing" a setting — delete the row for the scope you own,
// and the resolver falls back to the next wider scope.

import { prisma } from '@/lib/prisma'
import type { Prisma, SettingScope } from '@prisma/client'

import { PLATFORM_SCOPE_ID } from './scope'

/**
 * Upsert a PLATFORM-scoped setting (the "default" value used when
 * neither the company nor the user has overridden it). Storing
 * `null` deletes the row so lookups fall through to the env-var
 * fallback again (this matches the old AppSetting service's semantics).
 */
export async function setPlatformSetting(
  key: string,
  value: Prisma.InputJsonValue | null,
  updatedById?: string | null,
): Promise<void> {
  if (value === null) {
    await prisma.setting.deleteMany({
      where: { scope: 'PLATFORM', scopeId: PLATFORM_SCOPE_ID, key },
    })
    return
  }
  await prisma.setting.upsert({
    where: {
      scope_scopeId_key: {
        scope: 'PLATFORM',
        scopeId: PLATFORM_SCOPE_ID,
        key,
      },
    },
    create: {
      scope: 'PLATFORM',
      scopeId: PLATFORM_SCOPE_ID,
      key,
      value,
      updatedById: updatedById ?? null,
    },
    update: { value, updatedById: updatedById ?? null },
  })
}

/**
 * Upsert a COMPANY- or USER-scoped setting. `scopeId` must be the
 * matching id — the caller has already verified they're allowed to
 * write at that scope.
 */
export async function setScopedSetting(
  scope: Exclude<SettingScope, 'PLATFORM'>,
  scopeId: string,
  key: string,
  value: Prisma.InputJsonValue | null,
  updatedById?: string | null,
): Promise<void> {
  if (value === null) {
    await prisma.setting.deleteMany({ where: { scope, scopeId, key } })
    return
  }
  await prisma.setting.upsert({
    where: { scope_scopeId_key: { scope, scopeId, key } },
    create: {
      scope,
      scopeId,
      key,
      value,
      updatedById: updatedById ?? null,
    },
    update: { value, updatedById: updatedById ?? null },
  })
}
