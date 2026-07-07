import { Prisma } from '@prisma/client'
import type {
  EmploymentType,
  OrgAuditAction,
  OrgNodeKind,
} from '@prisma/client'

import { prisma } from '@/lib/prisma'

export interface OrgBoardRevisionSummary {
  id: string
  name: string
  description: string | null
  isCurrent: boolean
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface OrgNodeEmployeeRef {
  id: string
  name: string
  roleTitle: string
}

/**
 * Flat view of a node used by the top-level list + drill-down
 * pages. Client-side code rebuilds the tree from parentId so we
 * don't pay serialisation cost on deeply-nested Prisma includes.
 */
export interface OrgNodeRow {
  id: string
  revisionId: string
  parentId: string | null
  kind: OrgNodeKind
  label: string
  deptNumber: number | null
  positionTitle: string | null
  vfp: string | null
  /** How this seat operates — distinct from VFP (which is the output). */
  functionText: string | null
  responsibilities: string[]
  notes: string | null
  color: string | null
  orderIndex: number
  employee: OrgNodeEmployeeRef | null
  freeTextHolder: string | null
  /** Number of active (endedAt = null) position_assignments for
   *  this node. Used for the "+N" badge next to the primary
   *  holder. Zero when nobody's assigned yet. */
  activeAssignmentsCount: number
}

export interface OrgBoardTree {
  revision: OrgBoardRevisionSummary
  nodes: OrgNodeRow[]
}

export interface CreateOrgNodeArgs {
  revisionId: string
  parentId: string | null
  kind: OrgNodeKind
  label: string
  positionTitle?: string | null
  deptNumber?: number | null
  color?: string | null
  vfp?: string | null
  functionText?: string | null
  responsibilities?: string[]
  notes?: string | null
  employeeId?: string | null
  freeTextHolder?: string | null
}

export interface UpdateOrgNodeArgs {
  label?: string
  positionTitle?: string | null
  deptNumber?: number | null
  color?: string | null
  vfp?: string | null
  functionText?: string | null
  responsibilities?: string[]
  notes?: string | null
  employeeId?: string | null
  freeTextHolder?: string | null
}

export interface OrgNodeDeleteImpact {
  descendantCount: number
  positionsWithEmployeeCount: number
}

export interface PositionAssignmentRow {
  id: string
  nodeId: string
  employee: OrgNodeEmployeeRef
  dateAssigned: Date
  endedAt: Date | null
  employmentType: EmploymentType | null
  notes: string | null
}

export interface AddAssignmentArgs {
  nodeId: string
  employeeId: string
  dateAssigned?: Date
  employmentType?: EmploymentType | null
  notes?: string | null
}

/**
 * Attached to every mutation so we can attribute the audit log
 * entry. Optional so internal callers (jobs, seeds) that don't
 * have a user context can still mutate without pretending.
 */
export interface AuditContext {
  actorUserId?: string | null
}

export interface AuditLogEntry {
  id: string
  revisionId: string
  nodeId: string | null
  actor: { id: string; name: string | null; email: string } | null
  action: OrgAuditAction
  oldValue: unknown
  newValue: unknown
  createdAt: Date
}

function mapRow(row: {
  id: string
  revisionId: string
  parentId: string | null
  kind: OrgNodeKind
  label: string
  deptNumber: number | null
  positionTitle: string | null
  vfp: string | null
  functionText: string | null
  responsibilities: string[]
  notes: string | null
  color: string | null
  orderIndex: number
  freeTextHolder: string | null
  employee: { id: string; name: string; roleTitle: string } | null
  activeAssignmentsCount?: number
}): OrgNodeRow {
  return {
    id: row.id,
    revisionId: row.revisionId,
    parentId: row.parentId,
    kind: row.kind,
    label: row.label,
    deptNumber: row.deptNumber,
    positionTitle: row.positionTitle,
    vfp: row.vfp,
    functionText: row.functionText,
    responsibilities: row.responsibilities,
    notes: row.notes,
    color: row.color,
    orderIndex: row.orderIndex,
    freeTextHolder: row.freeTextHolder,
    activeAssignmentsCount: row.activeAssignmentsCount ?? 0,
    employee: row.employee
      ? {
          id: row.employee.id,
          name: row.employee.name,
          roleTitle: row.employee.roleTitle,
        }
      : null,
  }
}

function mapRevision(r: {
  id: string
  name: string
  description: string | null
  isCurrent: boolean
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
}): OrgBoardRevisionSummary {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    isCurrent: r.isCurrent,
    publishedAt: r.publishedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

class OrgBoardService {
  async listRevisions(): Promise<OrgBoardRevisionSummary[]> {
    const rows = await prisma.orgBoardRevision.findMany({
      orderBy: [{ isCurrent: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
    })
    return rows.map(mapRevision)
  }

  async getCurrentRevision(): Promise<OrgBoardRevisionSummary | null> {
    const row = await prisma.orgBoardRevision.findFirst({
      where: { isCurrent: true },
      orderBy: { updatedAt: 'desc' },
    })
    return row ? mapRevision(row) : null
  }

  async getRevision(id: string): Promise<OrgBoardRevisionSummary | null> {
    const row = await prisma.orgBoardRevision.findUnique({ where: { id } })
    return row ? mapRevision(row) : null
  }

  /**
   * Return the flat node list for a revision. Callers rebuild the
   * parent/children tree themselves — Prisma's nested includes get
   * expensive at 5+ levels of depth, and the row count is small
   * enough (~100) that a single flat query is fine.
   */
  async getNodes(revisionId: string): Promise<OrgNodeRow[]> {
    const rows = await prisma.orgNode.findMany({
      where: { revisionId },
      orderBy: [{ orderIndex: 'asc' }],
      include: {
        employee: { select: { id: true, name: true, roleTitle: true } },
        // Count only active (open-ended) assignments — historical
        // rows shouldn't inflate the "+N" badge.
        _count: { select: { assignments: { where: { endedAt: null } } } },
      },
    })
    return rows.map((r) =>
      mapRow({
        ...r,
        activeAssignmentsCount: r._count.assignments,
      }),
    )
  }

  /** Get the current revision AND its nodes in a single call. */
  async getCurrentTree(): Promise<OrgBoardTree | null> {
    const revision = await this.getCurrentRevision()
    if (!revision) return null
    const nodes = await this.getNodes(revision.id)
    return { revision, nodes }
  }

  async getTreeForRevision(revisionId: string): Promise<OrgBoardTree | null> {
    const revision = await this.getRevision(revisionId)
    if (!revision) return null
    const nodes = await this.getNodes(revisionId)
    return { revision, nodes }
  }

  /**
   * Returns the target node itself, all of its descendants (any
   * depth), and the ancestor chain up to the revision root. Used
   * by the drill-down page to render a division/department with
   * its whole subtree plus a breadcrumb.
   *
   * Two DB round-trips: one to fetch the ancestor chain (uses the
   * flat node list already available on the revision), one for
   * the subtree. Both are small enough that we don't need a
   * recursive CTE.
   */
  async getNodeWithSubtree(id: string): Promise<{
    node: OrgNodeRow
    ancestors: OrgNodeRow[]
    subtree: OrgNodeRow[]
    revision: OrgBoardRevisionSummary
  } | null> {
    const target = await prisma.orgNode.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, name: true, roleTitle: true } },
      },
    })
    if (!target) return null

    // Grab every node in this revision so we can walk both the
    // ancestor chain and the descendant tree in-memory.
    const revision = await this.getRevision(target.revisionId)
    if (!revision) return null
    const all = await this.getNodes(target.revisionId)

    const byId = new Map(all.map((n) => [n.id, n]))
    const childrenOf = new Map<string, OrgNodeRow[]>()
    for (const n of all) {
      if (!n.parentId) continue
      const list = childrenOf.get(n.parentId) ?? []
      list.push(n)
      childrenOf.set(n.parentId, list)
    }
    for (const list of childrenOf.values()) {
      list.sort((a, b) => a.orderIndex - b.orderIndex)
    }

    // Ancestor walk, closest first, dropped once we return.
    const ancestors: OrgNodeRow[] = []
    let cursorParentId = target.parentId
    while (cursorParentId) {
      const parent = byId.get(cursorParentId)
      if (!parent) break
      ancestors.push(parent)
      cursorParentId = parent.parentId
    }
    ancestors.reverse() // root first, matches breadcrumb order

    // BFS to gather descendants including the target itself.
    const subtree: OrgNodeRow[] = []
    const seed = byId.get(target.id)
    if (!seed) return null
    const queue: OrgNodeRow[] = [seed]
    while (queue.length > 0) {
      const cur = queue.shift()!
      subtree.push(cur)
      const kids = childrenOf.get(cur.id) ?? []
      queue.push(...kids)
    }

    return { node: seed, ancestors, subtree, revision }
  }

  // -----------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------

  /**
   * Internal helper — writes a single append-only audit entry.
   * Called by every mutation; failures are swallowed with a
   * console.error because losing an audit line should never
   * break the mutation the user came for.
   */
  private async writeAudit(
    revisionId: string,
    nodeId: string | null,
    action: OrgAuditAction,
    ctx: AuditContext | undefined,
    oldValue: unknown,
    newValue: unknown,
  ): Promise<void> {
    try {
      await prisma.orgNodeAuditLog.create({
        data: {
          revisionId,
          nodeId,
          actorUserId: ctx?.actorUserId ?? null,
          action,
          oldValue: oldValue === undefined ? Prisma.JsonNull : (oldValue as Prisma.InputJsonValue),
          newValue: newValue === undefined ? Prisma.JsonNull : (newValue as Prisma.InputJsonValue),
        },
      })
    } catch (err) {
      console.error('org audit log write failed:', err)
    }
  }

  /** Compact snapshot of node fields we care about for audit. */
  private auditSnapshot(row: {
    id: string
    kind: OrgNodeKind
    label: string
    positionTitle: string | null
    parentId: string | null
    employeeId: string | null
    freeTextHolder: string | null
    color: string | null
    vfp: string | null
    functionText: string | null
    orderIndex: number
  }) {
    return {
      id: row.id,
      kind: row.kind,
      label: row.label,
      positionTitle: row.positionTitle,
      parentId: row.parentId,
      employeeId: row.employeeId,
      freeTextHolder: row.freeTextHolder,
      color: row.color,
      vfp: row.vfp,
      functionText: row.functionText,
      orderIndex: row.orderIndex,
    }
  }

  async addNode(input: CreateOrgNodeArgs, ctx?: AuditContext): Promise<OrgNodeRow> {
    // Append at the end of the parent's children — matches the
    // "Add Position" / "Add Section" expectation of showing up at
    // the bottom of the current list.
    const last = await prisma.orgNode.findFirst({
      where: { revisionId: input.revisionId, parentId: input.parentId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    })
    const nextIndex = (last?.orderIndex ?? -1) + 1

    // Cross-check that either employeeId or freeTextHolder is set,
    // not both. Zod already covers callers going through the action
    // layer; belt-and-braces for internal use.
    if (input.employeeId && input.freeTextHolder) {
      throw new Error('Pick either an employee or a placeholder, not both')
    }

    const row = await prisma.orgNode.create({
      data: {
        revisionId: input.revisionId,
        parentId: input.parentId,
        kind: input.kind,
        label: input.label,
        positionTitle: input.positionTitle ?? null,
        deptNumber: input.deptNumber ?? null,
        color: input.color ?? null,
        vfp: input.vfp ?? null,
        functionText: input.functionText ?? null,
        responsibilities: input.responsibilities ?? [],
        notes: input.notes ?? null,
        employeeId: input.employeeId ?? null,
        freeTextHolder: input.freeTextHolder ?? null,
        orderIndex: nextIndex,
      },
      include: { employee: { select: { id: true, name: true, roleTitle: true } } },
    })
    await this.writeAudit(
      row.revisionId,
      row.id,
      'NODE_CREATED',
      ctx,
      null,
      this.auditSnapshot(row),
    )
    return mapRow(row)
  }

  async updateNode(
    id: string,
    input: UpdateOrgNodeArgs,
    ctx?: AuditContext,
  ): Promise<OrgNodeRow> {
    if (input.employeeId && input.freeTextHolder) {
      throw new Error('Pick either an employee or a placeholder, not both')
    }
    const data: Prisma.OrgNodeUpdateInput = {}
    if (input.label !== undefined) data.label = input.label
    if (input.positionTitle !== undefined) data.positionTitle = input.positionTitle
    if (input.deptNumber !== undefined) data.deptNumber = input.deptNumber
    if (input.color !== undefined) data.color = input.color
    if (input.vfp !== undefined) data.vfp = input.vfp
    if (input.functionText !== undefined) data.functionText = input.functionText
    if (input.responsibilities !== undefined) data.responsibilities = input.responsibilities
    if (input.notes !== undefined) data.notes = input.notes
    if (input.employeeId !== undefined) {
      data.employee = input.employeeId
        ? { connect: { id: input.employeeId } }
        : { disconnect: true }
    }
    if (input.freeTextHolder !== undefined) data.freeTextHolder = input.freeTextHolder

    const before = await prisma.orgNode.findUnique({ where: { id } })
    const row = await prisma.orgNode.update({
      where: { id },
      data,
      include: { employee: { select: { id: true, name: true, roleTitle: true } } },
    })
    await this.writeAudit(
      row.revisionId,
      row.id,
      'NODE_UPDATED',
      ctx,
      before ? this.auditSnapshot(before) : null,
      this.auditSnapshot(row),
    )
    return mapRow(row)
  }

  /**
   * Preview a delete before executing. Counts the whole subtree so
   * the admin sees "removing this Division will delete 3 departments
   * + 4 positions holding employees" style detail.
   */
  async deleteImpact(id: string): Promise<OrgNodeDeleteImpact> {
    const target = await prisma.orgNode.findUnique({
      where: { id },
      select: { revisionId: true, id: true, parentId: true },
    })
    if (!target) throw new Error('Org node not found')
    const all = await prisma.orgNode.findMany({
      where: { revisionId: target.revisionId },
      select: { id: true, parentId: true, employeeId: true },
    })
    const childrenOf = new Map<string, string[]>()
    for (const n of all) {
      if (!n.parentId) continue
      const list = childrenOf.get(n.parentId) ?? []
      list.push(n.id)
      childrenOf.set(n.parentId, list)
    }
    const empById = new Map(all.map((n) => [n.id, n.employeeId]))
    // BFS descendants (excluding the target itself for the count).
    const visited: string[] = []
    const queue: string[] = [target.id]
    while (queue.length > 0) {
      const cur = queue.shift()!
      const kids = childrenOf.get(cur) ?? []
      for (const k of kids) {
        visited.push(k)
        queue.push(k)
      }
    }
    let empCount = 0
    for (const idInSub of visited) {
      if (empById.get(idInSub)) empCount++
    }
    // Also count the target itself if it's a POSITION holding an
    // employee.
    if (empById.get(target.id)) empCount++
    return {
      descendantCount: visited.length,
      positionsWithEmployeeCount: empCount,
    }
  }

  async deleteNode(id: string, ctx?: AuditContext): Promise<void> {
    const before = await prisma.orgNode.findUnique({ where: { id } })
    if (!before) return
    // Cascade in schema handles descendants.
    await prisma.orgNode.delete({ where: { id } })
    // nodeId=null because the row itself is gone; revisionId
    // survives so the log is still queryable per board.
    await this.writeAudit(
      before.revisionId,
      null,
      'NODE_DELETED',
      ctx,
      this.auditSnapshot(before),
      null,
    )
  }

  /**
   * Swap `orderIndex` with the previous or next sibling. "up" and
   * "left" both step to the earlier sibling; "down" and "right" to
   * the later one. If already at the boundary, no-op.
   */
  async moveNode(
    id: string,
    direction: 'up' | 'down' | 'left' | 'right',
    ctx?: AuditContext,
  ): Promise<void> {
    const target = await prisma.orgNode.findUnique({
      where: { id },
      select: {
        id: true,
        revisionId: true,
        parentId: true,
        orderIndex: true,
      },
    })
    if (!target) throw new Error('Org node not found')

    const forward = direction === 'down' || direction === 'right'
    const sibling = forward
      ? await prisma.orgNode.findFirst({
          where: {
            revisionId: target.revisionId,
            parentId: target.parentId,
            orderIndex: { gt: target.orderIndex },
          },
          orderBy: { orderIndex: 'asc' },
        })
      : await prisma.orgNode.findFirst({
          where: {
            revisionId: target.revisionId,
            parentId: target.parentId,
            orderIndex: { lt: target.orderIndex },
          },
          orderBy: { orderIndex: 'desc' },
        })
    if (!sibling) return

    // Two-phase swap so we don't collide on any future
    // (revisionId, parentId, orderIndex) uniqueness.
    await prisma.$transaction([
      prisma.orgNode.update({
        where: { id: target.id },
        data: { orderIndex: -1 * (target.orderIndex + 1) },
      }),
      prisma.orgNode.update({
        where: { id: sibling.id },
        data: { orderIndex: target.orderIndex },
      }),
      prisma.orgNode.update({
        where: { id: target.id },
        data: { orderIndex: sibling.orderIndex },
      }),
    ])
    await this.writeAudit(
      target.revisionId,
      target.id,
      'NODE_MOVED',
      ctx,
      { orderIndex: target.orderIndex, direction },
      { orderIndex: sibling.orderIndex, swappedWith: sibling.id },
    )
  }

  // -----------------------------------------------------------------
  // Position assignments — N:M layer supporting multiple holders per
  // node ("three Video Editors", "two Ads Managers", ...). The 1:1
  // `OrgNode.employeeId` stays around as the "primary" holder for
  // now so existing UI keeps working; new code should prefer the
  // assignments list.
  // -----------------------------------------------------------------

  async listAssignments(
    nodeId: string,
    options: { includeEnded?: boolean } = {},
  ): Promise<PositionAssignmentRow[]> {
    const rows = await prisma.positionAssignment.findMany({
      where: {
        nodeId,
        ...(options.includeEnded ? {} : { endedAt: null }),
      },
      orderBy: [{ dateAssigned: 'asc' }, { createdAt: 'asc' }],
      include: {
        employee: { select: { id: true, name: true, roleTitle: true } },
      },
    })
    return rows.map((r) => ({
      id: r.id,
      nodeId: r.nodeId,
      employee: {
        id: r.employee.id,
        name: r.employee.name,
        roleTitle: r.employee.roleTitle,
      },
      dateAssigned: r.dateAssigned,
      endedAt: r.endedAt,
      employmentType: r.employmentType,
      notes: r.notes,
    }))
  }

  async addAssignment(
    args: AddAssignmentArgs,
    ctx?: AuditContext,
  ): Promise<PositionAssignmentRow> {
    // Guard against duplicate live assignments — same employee
    // already actively holds this seat. Two rows would mostly work
    // but downstream counts would misreport.
    const existing = await prisma.positionAssignment.findFirst({
      where: {
        nodeId: args.nodeId,
        employeeId: args.employeeId,
        endedAt: null,
      },
      select: { id: true },
    })
    if (existing) {
      throw new Error('This employee is already assigned to this position')
    }
    const row = await prisma.positionAssignment.create({
      data: {
        nodeId: args.nodeId,
        employeeId: args.employeeId,
        dateAssigned: args.dateAssigned ?? new Date(),
        employmentType: args.employmentType ?? null,
        notes: args.notes ?? null,
      },
      include: {
        employee: { select: { id: true, name: true, roleTitle: true } },
      },
    })
    const node = await prisma.orgNode.findUnique({
      where: { id: row.nodeId },
      select: { revisionId: true },
    })
    if (node) {
      await this.writeAudit(
        node.revisionId,
        row.nodeId,
        'ASSIGNMENT_ADDED',
        ctx,
        null,
        {
          assignmentId: row.id,
          employeeId: row.employeeId,
          employeeName: row.employee.name,
          employmentType: row.employmentType,
          dateAssigned: row.dateAssigned,
        },
      )
    }
    return {
      id: row.id,
      nodeId: row.nodeId,
      employee: {
        id: row.employee.id,
        name: row.employee.name,
        roleTitle: row.employee.roleTitle,
      },
      dateAssigned: row.dateAssigned,
      endedAt: row.endedAt,
      employmentType: row.employmentType,
      notes: row.notes,
    }
  }

  /**
   * Soft-end an assignment. We keep the row for history so an admin
   * can later see who held a seat and when. `endedAt` defaults to
   * now.
   */
  async endAssignment(
    assignmentId: string,
    endedAt: Date = new Date(),
    ctx?: AuditContext,
  ): Promise<void> {
    const before = await prisma.positionAssignment.findUnique({
      where: { id: assignmentId },
      include: { node: { select: { revisionId: true } }, employee: { select: { name: true } } },
    })
    await prisma.positionAssignment.update({
      where: { id: assignmentId },
      data: { endedAt },
    })
    if (before) {
      await this.writeAudit(
        before.node.revisionId,
        before.nodeId,
        'ASSIGNMENT_ENDED',
        ctx,
        {
          assignmentId,
          employeeId: before.employeeId,
          employeeName: before.employee.name,
          dateAssigned: before.dateAssigned,
        },
        { endedAt },
      )
    }
  }

  /**
   * Dashboard-friendly aggregate counts for a revision. Filled /
   * vacant assumes a "position with a primary employeeId or any
   * active assignment" is filled. Everything else is vacant.
   */
  async getStats(revisionId: string): Promise<{
    divisions: number
    departments: number
    sections: number
    units: number
    positions: number
    filledPositions: number
    vacantPositions: number
    employeesAssigned: number
    departmentsWithVacancies: number
  }> {
    const nodes = await prisma.orgNode.findMany({
      where: { revisionId },
      include: {
        _count: { select: { assignments: { where: { endedAt: null } } } },
      },
    })
    let divisions = 0
    let departments = 0
    let sections = 0
    let units = 0
    let positions = 0
    let filled = 0
    const filledDeptIds = new Set<string>()
    const employeeIds = new Set<string>()

    for (const n of nodes) {
      if (n.kind === 'DIVISION') divisions++
      else if (n.kind === 'DEPARTMENT') departments++
      else if (n.kind === 'SECTION') sections++
      else if (n.kind === 'UNIT') units++
      else if (n.kind === 'POSITION') positions++
      const isFilled = Boolean(n.employeeId) || n._count.assignments > 0
      if (n.kind === 'POSITION' && isFilled) filled++
      if (n.employeeId) employeeIds.add(n.employeeId)
    }

    // Second pass: for every DEPARTMENT, check whether any
    // descendant POSITION is vacant. We do this via a childrenOf
    // walk since we already have the flat list in memory.
    const childrenOf = new Map<string, typeof nodes>()
    for (const n of nodes) {
      if (!n.parentId) continue
      const list = childrenOf.get(n.parentId) ?? []
      list.push(n)
      childrenOf.set(n.parentId, list)
    }
    let departmentsWithVacancies = 0
    for (const dept of nodes) {
      if (dept.kind !== 'DEPARTMENT') continue
      // BFS descendants
      let hasVacancy = false
      const queue: typeof nodes = [...(childrenOf.get(dept.id) ?? [])]
      while (queue.length > 0) {
        const cur = queue.shift()!
        if (cur.kind === 'POSITION') {
          const isFilled = Boolean(cur.employeeId) || cur._count.assignments > 0
          if (!isFilled) {
            hasVacancy = true
            break
          }
        }
        queue.push(...(childrenOf.get(cur.id) ?? []))
      }
      if (hasVacancy) {
        departmentsWithVacancies++
        filledDeptIds.add(dept.id) // just to keep set typed
      }
    }
    // filledDeptIds size not surfaced; kept to avoid unused var
    void filledDeptIds

    // Distinct employees appearing in position_assignments too.
    const activeAssignEmployees = await prisma.positionAssignment.findMany({
      where: { node: { revisionId }, endedAt: null },
      select: { employeeId: true },
      distinct: ['employeeId'],
    })
    for (const a of activeAssignEmployees) employeeIds.add(a.employeeId)

    return {
      divisions,
      departments,
      sections,
      units,
      positions,
      filledPositions: filled,
      vacantPositions: positions - filled,
      employeesAssigned: employeeIds.size,
      departmentsWithVacancies,
    }
  }

  /**
   * Return the most recent audit entries for a revision. Defaults
   * to 100 rows — the dashboard "Recently updated" panel uses this
   * and drops any older detail on the floor.
   */
  async listAuditLogs(
    revisionId: string,
    limit = 100,
  ): Promise<AuditLogEntry[]> {
    const rows = await prisma.orgNodeAuditLog.findMany({
      where: { revisionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        actor: { select: { id: true, name: true, email: true } },
      },
    })
    return rows.map((r) => ({
      id: r.id,
      revisionId: r.revisionId,
      nodeId: r.nodeId,
      actor: r.actor
        ? { id: r.actor.id, name: r.actor.name, email: r.actor.email }
        : null,
      action: r.action,
      oldValue: r.oldValue,
      newValue: r.newValue,
      createdAt: r.createdAt,
    }))
  }
}

export const orgBoardService = new OrgBoardService()
