'use server'

import { revalidatePath } from 'next/cache'

import { requireTeamModuleAccess } from '@/lib/auth/get-user'
import { writeAuditLog } from '@/lib/services/audit-log-service'
import {
  roleService,
  type RoleSummary,
} from '@/lib/services/role-service'
import type { TeamModuleKey } from '@/lib/config/team-modules'

export type { RoleSummary } from '@/lib/services/role-service'

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
  console.error('[roles/actions]', fallback, err)
  const message = err instanceof Error ? err.message : fallback
  return { ok: false, error: message }
}

export async function fetchRolesAction(): Promise<Result<RoleSummary[]>> {
  await requireTeamModuleAccess('roles')
  try {
    return { ok: true, data: await roleService.listRoles() }
  } catch (err) {
    return toErr(err, 'Could not load roles')
  }
}

export async function createRoleAction(input: {
  name: string
  description?: string
  moduleKeys: TeamModuleKey[]
}): Promise<Result<RoleSummary>> {
  const admin = await requireTeamModuleAccess('roles')
  try {
    const data = await roleService.createRole({
      name: input.name,
      description: input.description ?? null,
      moduleKeys: input.moduleKeys,
    })
    await writeAuditLog({
      actorId: admin.id,
      action: 'role.create',
      resourceType: 'role',
      resourceId: data.id,
      summary: `Created role "${data.name}" with ${data.moduleKeys.length} module${data.moduleKeys.length === 1 ? '' : 's'}`,
    })
    revalidatePath('/admin/roles')
    return { ok: true, data }
  } catch (err) {
    return toErr(err, 'Could not create role')
  }
}

export async function updateRoleAction(
  id: string,
  input: {
    name?: string
    description?: string | null
    moduleKeys?: TeamModuleKey[]
  },
): Promise<Result<RoleSummary>> {
  const admin = await requireTeamModuleAccess('roles')
  try {
    const data = await roleService.updateRole(id, input)
    await writeAuditLog({
      actorId: admin.id,
      action: 'role.update',
      resourceType: 'role',
      resourceId: id,
      summary: `Updated role "${data.name}"`,
    })
    revalidatePath('/admin/roles')
    return { ok: true, data }
  } catch (err) {
    return toErr(err, 'Could not update role')
  }
}

export async function deleteRoleAction(
  id: string,
): Promise<Result> {
  const admin = await requireTeamModuleAccess('roles')
  try {
    await roleService.deleteRole(id)
    await writeAuditLog({
      actorId: admin.id,
      action: 'role.delete',
      resourceType: 'role',
      resourceId: id,
      summary: `Deleted role ${id}`,
    })
    revalidatePath('/admin/roles')
    return { ok: true, data: undefined }
  } catch (err) {
    return toErr(err, 'Could not delete role')
  }
}
