'use server'

// Server actions for the per-user module-access grid on /admin/team.
// Only ADMIN can grant/revoke. Reads (fetchTeamAccessAction) let the
// grid dialog pre-check the right boxes; writes are optimistic on
// the client + rolled back on error.

import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/auth/get-user'
import {
  teamAccessService,
  TeamAccessTargetError,
  UnknownModuleError,
  type ActiveGrant,
} from '@/lib/services/team-access-service'

interface Ok<T = void> {
  ok: true
  data: T
}
interface Err {
  ok: false
  error?: string
}
type Result<T = void> = Ok<T> | Err

function toErr(err: unknown, fallback: string): Err {
  if (
    err instanceof UnknownModuleError ||
    err instanceof TeamAccessTargetError
  ) {
    return { ok: false, error: err.message }
  }
  console.error('[team/actions]', fallback, err)
  const message = err instanceof Error ? err.message : fallback
  return { ok: false, error: message }
}

function revalidateAll(): void {
  revalidatePath('/admin/team')
  revalidatePath('/admin/members')
}

export async function fetchTeamAccessAction(
  userId: string,
): Promise<Result<ActiveGrant[]>> {
  await requireAdmin()
  try {
    const data = await teamAccessService.listActiveGrants(userId)
    return { ok: true, data }
  } catch (err) {
    return toErr(err, 'Could not load access grants')
  }
}

export async function grantModuleAccessAction(input: {
  targetUserId: string
  moduleKey: string
}): Promise<Result<ActiveGrant>> {
  const admin = await requireAdmin()
  try {
    const data = await teamAccessService.grant({
      targetUserId: input.targetUserId,
      moduleKey: input.moduleKey,
      grantedById: admin.id,
    })
    revalidateAll()
    return { ok: true, data }
  } catch (err) {
    return toErr(err, 'Could not grant access')
  }
}

export async function revokeModuleAccessAction(input: {
  targetUserId: string
  moduleKey: string
}): Promise<Result> {
  const admin = await requireAdmin()
  try {
    await teamAccessService.revoke({
      targetUserId: input.targetUserId,
      moduleKey: input.moduleKey,
      revokedById: admin.id,
    })
    revalidateAll()
    return { ok: true, data: undefined }
  } catch (err) {
    return toErr(err, 'Could not revoke access')
  }
}
