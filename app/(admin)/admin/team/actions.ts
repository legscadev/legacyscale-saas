'use server'

// Server actions for the per-user role-assignment dialog on
// /admin/team. Only ADMIN can assign; reads let the dialog
// pre-check the right boxes.
//
// Deliberately NO revalidatePath here. The /admin/team list
// doesn't display roles — refetching would re-render the whole
// page and close the dialog. Fresh assignments are picked up the
// next time the dialog opens or the target user navigates.

import {  requireTeamModuleAccess  } from "@/lib/auth/get-user"
import { writeAuditLog } from '@/lib/services/audit-log-service'
import {
  roleService,
  RoleTargetError,
  UnknownModuleError,
  type AssignedRole,
  type RoleSummary,
} from '@/lib/services/role-service'

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
  if (err instanceof UnknownModuleError || err instanceof RoleTargetError) {
    return { ok: false, error: err.message }
  }
  console.error('[team/actions]', fallback, err)
  const message = err instanceof Error ? err.message : fallback
  return { ok: false, error: message }
}

export async function fetchUserRolesAction(
  userId: string,
): Promise<Result<AssignedRole[]>> {
  await requireTeamModuleAccess("team")
  try {
    const data = await roleService.listAssignmentsForUser(userId)
    return { ok: true, data }
  } catch (err) {
    return toErr(err, 'Could not load role assignments')
  }
}

export async function fetchAvailableRolesAction(): Promise<Result<RoleSummary[]>> {
  await requireTeamModuleAccess("team")
  try {
    const data = await roleService.listRoles()
    return { ok: true, data }
  } catch (err) {
    return toErr(err, 'Could not load roles')
  }
}

export async function setUserRolesAction(input: {
  targetUserId: string
  roleIds: string[]
}): Promise<Result> {
  const admin = await requireTeamModuleAccess("team")
  try {
    await roleService.setUserRoles({
      targetUserId: input.targetUserId,
      roleIds: input.roleIds,
      assignedById: admin.id,
    })
    await writeAuditLog({
      actorId: admin.id,
      action: 'access.role.assign',
      resourceType: 'userRoleAssignment',
      resourceId: input.targetUserId,
      summary: `Set roles for user ${input.targetUserId} (${input.roleIds.length} role${input.roleIds.length === 1 ? '' : 's'})`,
    })
    return { ok: true, data: undefined }
  } catch (err) {
    return toErr(err, 'Could not update roles')
  }
}
