'use server'

import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/auth/get-user'
import { orgBoardService } from '@/lib/services/org-board-service'
import { employeeService } from '@/lib/services/employee-service'
import {
  addPositionAssignmentSchema,
  createOrgNodeSchema,
  moveOrgNodeSchema,
  updateOrgNodeSchema,
  type AddPositionAssignmentInput,
  type CreateOrgNodeInput,
  type MoveOrgNodeInput,
  type UpdateOrgNodeInput,
} from '@/lib/validations/org-board'

function revalidate(nodeId?: string) {
  revalidatePath('/admin/org-board')
  if (nodeId) revalidatePath(`/admin/org-board/nodes/${nodeId}`)
}

export async function searchAssignableEmployeesAction(query: string) {
  await requireAdmin()
  // Reuse the onboarding search but reshape to the trimmer shape
  // the org-board dialog needs. Callers don't care about the
  // "already linked" state — an employee can hold multiple org
  // positions if HR insists, so we surface all matches.
  const users = await employeeService.searchLinkableUsers(query)
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
  }))
}

export async function addOrgNodeAction(
  revisionId: string,
  input: CreateOrgNodeInput,
) {
  const admin = await requireAdmin()
  const parsed = createOrgNodeSchema.parse(input)
  const node = await orgBoardService.addNode(
    {
      revisionId,
      parentId: parsed.parentId ?? null,
      kind: parsed.kind,
      label: parsed.label,
      positionTitle: parsed.positionTitle ?? null,
      deptNumber: parsed.deptNumber ?? null,
      color: parsed.color ?? null,
      vfp: parsed.vfp ?? null,
      functionText: parsed.functionText ?? null,
      responsibilities: parsed.responsibilities,
      notes: parsed.notes ?? null,
      employeeId: parsed.employeeId ?? null,
      freeTextHolder: parsed.freeTextHolder ?? null,
    },
    { actorUserId: admin.id },
  )
  revalidate(parsed.parentId ?? undefined)
  return node
}

export async function updateOrgNodeAction(
  id: string,
  input: UpdateOrgNodeInput,
) {
  const admin = await requireAdmin()
  const parsed = updateOrgNodeSchema.parse(input)
  const node = await orgBoardService.updateNode(id, parsed, { actorUserId: admin.id })
  revalidate(id)
  return node
}

export async function getOrgNodeDeleteImpactAction(id: string) {
  await requireAdmin()
  return orgBoardService.deleteImpact(id)
}

export async function deleteOrgNodeAction(id: string) {
  const admin = await requireAdmin()
  await orgBoardService.deleteNode(id, { actorUserId: admin.id })
  revalidate()
}

export async function moveOrgNodeAction(
  id: string,
  input: MoveOrgNodeInput,
) {
  const admin = await requireAdmin()
  const parsed = moveOrgNodeSchema.parse(input)
  await orgBoardService.moveNode(id, parsed.direction, { actorUserId: admin.id })
  revalidate(id)
}

// -----------------------------------------------------------------
// Position assignments
// -----------------------------------------------------------------

export async function listPositionAssignmentsAction(
  nodeId: string,
  options: { includeEnded?: boolean } = {},
) {
  await requireAdmin()
  return orgBoardService.listAssignments(nodeId, options)
}

export async function addPositionAssignmentAction(
  nodeId: string,
  input: AddPositionAssignmentInput,
) {
  const admin = await requireAdmin()
  const parsed = addPositionAssignmentSchema.parse(input)
  const row = await orgBoardService.addAssignment(
    {
      nodeId,
      employeeId: parsed.employeeId,
      employmentType: parsed.employmentType ?? null,
      notes: parsed.notes ?? null,
    },
    { actorUserId: admin.id },
  )
  revalidate(nodeId)
  return row
}

export async function endPositionAssignmentAction(
  assignmentId: string,
  nodeId: string,
) {
  const admin = await requireAdmin()
  await orgBoardService.endAssignment(assignmentId, new Date(), {
    actorUserId: admin.id,
  })
  revalidate(nodeId)
}

export async function listOrgAuditLogsAction(revisionId: string, limit = 100) {
  await requireAdmin()
  return orgBoardService.listAuditLogs(revisionId, limit)
}
