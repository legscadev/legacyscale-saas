'use server'

import type { SuperAdminRole } from '@prisma/client'

import { requireActiveUser } from '@/lib/auth'
import {
  LastSuperAdminError,
  SelfRevokeError,
  UserNotFoundError,
  grantSuperAdmin,
  listSuperAdmins,
  revokeSuperAdmin,
  type SuperAdminRow,
} from '@/lib/services/super-admin-service'
import { isTenancyEnabled } from '@/lib/tenancy/feature-flag'

async function assertSuperAdmin() {
  if (!isTenancyEnabled()) {
    throw new Error('unauthorized: tenancy disabled')
  }
  const user = await requireActiveUser()
  if (!user.isSuperAdmin) {
    throw new Error('unauthorized: super-admin only')
  }
  return user
}

export async function fetchSuperAdmins(): Promise<SuperAdminRow[]> {
  const caller = await assertSuperAdmin()
  return listSuperAdmins(caller.id)
}

export interface GrantSuperAdminResult {
  ok: boolean
  wasNewlyCreated?: boolean
  error?: string
}

export async function grantSuperAdminAction(input: {
  email: string
  name?: string
  role?: SuperAdminRole
  expiresAt?: string | null
  notes?: string | null
}): Promise<GrantSuperAdminResult> {
  const caller = await assertSuperAdmin()
  try {
    // Parse the date input on the server so a malformed value from
    // the client fails loudly rather than silently landing null.
    let expiresAt: Date | null = null
    if (input.expiresAt) {
      const parsed = new Date(input.expiresAt)
      if (Number.isNaN(parsed.getTime())) {
        return { ok: false, error: 'Invalid expiry date' }
      }
      expiresAt = parsed
    }

    const { wasNewlyCreated } = await grantSuperAdmin({
      email: input.email,
      name: input.name,
      role: input.role,
      expiresAt,
      notes: input.notes,
      // Attribute the grant to the caller — powers the "Granted by"
      // column on /super/super-admins and the future audit view.
      grantedById: caller.id,
    })
    return { ok: true, wasNewlyCreated }
  } catch (err) {
    console.error('grantSuperAdminAction failed:', err)
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to grant super-admin',
    }
  }
}

export interface RevokeSuperAdminResult {
  ok: boolean
  error?: string
}

export async function revokeSuperAdminAction(input: {
  userId: string
}): Promise<RevokeSuperAdminResult> {
  const caller = await assertSuperAdmin()
  try {
    await revokeSuperAdmin({
      userId: input.userId,
      callerId: caller.id,
    })
    return { ok: true }
  } catch (err) {
    if (err instanceof LastSuperAdminError) {
      return {
        ok: false,
        error:
          'This is the last super-admin. Grant another user the flag first.',
      }
    }
    if (err instanceof SelfRevokeError) {
      return { ok: false, error: 'You cannot revoke your own super-admin flag.' }
    }
    if (err instanceof UserNotFoundError) {
      return { ok: false, error: 'User not found.' }
    }
    console.error('revokeSuperAdminAction failed:', err)
    return { ok: false, error: 'Failed to revoke super-admin' }
  }
}
