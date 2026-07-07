'use server'

import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/auth/get-user'
import { orgBoardService } from '@/lib/services/org-board-service'
import { prisma } from '@/lib/prisma'
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
  // Search the Employee table directly. Onboarding's
  // searchLinkableUsers returns User IDs, which look identical to
  // Employee IDs (both UUIDs) but reference a different table —
  // sending those back through addOrgNode would trip the
  // org_nodes.employee_id foreign key. We only surface ACTIVE
  // employees; offboarded ones are hidden so admins don't
  // accidentally seat a former hire.
  const q = query.trim()
  if (!q) return []
  const employees = await prisma.employee.findMany({
    where: {
      status: 'ACTIVE',
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { roleTitle: { contains: q, mode: 'insensitive' } },
      ],
    },
    take: 8,
    orderBy: [{ name: 'asc' }],
    select: {
      id: true,
      name: true,
      roleTitle: true,
      user: { select: { email: true, role: true } },
    },
  })
  return employees.map((e) => ({
    id: e.id,
    email: e.user?.email ?? '',
    name: e.name,
    role: (e.user?.role ?? 'TEAM') as 'ADMIN' | 'TEAM' | 'MEMBER',
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
