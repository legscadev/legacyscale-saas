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

/**
 * Search result shape used by the holder pickers. `kind: 'employee'`
 * results come with an Employee.id ready to store in
 * `OrgNode.employeeId`. `kind: 'user'` results are Users who don't
 * yet have an Employee record — picking one triggers a lazy upsert
 * via {@link resolveHolderToEmployeeAction} before the ID is used
 * in any mutation.
 */
export interface AssignablePickerResult {
  kind: 'employee' | 'user'
  id: string
  email: string
  name: string | null
  role: 'ADMIN' | 'TEAM' | 'MEMBER'
}

export async function searchAssignableEmployeesAction(
  query: string,
): Promise<AssignablePickerResult[]> {
  await requireAdmin()
  const q = query.trim()
  if (!q) return []

  const [employees, users] = await Promise.all([
    prisma.employee.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { roleTitle: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 6,
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        name: true,
        user: { select: { email: true, role: true } },
      },
    }),
    // Users without an Employee row — picking one upserts an
    // Employee on the fly. Users who already have an Employee are
    // covered by the first query above.
    prisma.user.findMany({
      where: {
        deletedAt: null,
        employee: null,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 6,
      orderBy: [{ name: 'asc' }],
      select: { id: true, name: true, email: true, role: true },
    }),
  ])

  return [
    ...employees.map<AssignablePickerResult>((e) => ({
      kind: 'employee',
      id: e.id,
      email: e.user?.email ?? '',
      name: e.name,
      role: (e.user?.role ?? 'TEAM') as 'ADMIN' | 'TEAM' | 'MEMBER',
    })),
    ...users.map<AssignablePickerResult>((u) => ({
      kind: 'user',
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
    })),
  ]
}

/**
 * Turns a picker result into an Employee.id ready for
 * OrgNode.employeeId / PositionAssignment.employeeId. Employee
 * picks pass through; User picks trigger an idempotent upsert
 * (unique on `employees.user_id`) so a user linked to an Employee
 * stays that way even if the admin picks them twice.
 */
export async function resolveHolderToEmployeeAction(
  pick: { kind: 'employee' | 'user'; id: string },
): Promise<string> {
  await requireAdmin()
  if (pick.kind === 'employee') return pick.id

  const user = await prisma.user.findUnique({
    where: { id: pick.id },
    select: {
      id: true,
      name: true,
      email: true,
      employee: { select: { id: true } },
    },
  })
  if (!user) throw new Error('User not found')
  if (user.employee) return user.employee.id

  const created = await prisma.employee.create({
    data: {
      userId: user.id,
      name: user.name ?? user.email,
      // Default title — admins can edit on the employee's onboarding
      // profile page later.
      roleTitle: 'Team Member',
    },
    select: { id: true },
  })
  return created.id
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
