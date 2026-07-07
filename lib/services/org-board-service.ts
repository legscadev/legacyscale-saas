import type { OrgNodeKind, Prisma } from '@prisma/client'

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
      },
    })
    return rows.map(mapRow)
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

  async addNode(input: CreateOrgNodeArgs): Promise<OrgNodeRow> {
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
    return mapRow(row)
  }

  async updateNode(
    id: string,
    input: UpdateOrgNodeArgs,
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

    const row = await prisma.orgNode.update({
      where: { id },
      data,
      include: { employee: { select: { id: true, name: true, roleTitle: true } } },
    })
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

  async deleteNode(id: string): Promise<void> {
    // Cascade in schema handles descendants.
    await prisma.orgNode.delete({ where: { id } })
  }

  /**
   * Swap `orderIndex` with the previous or next sibling. "up" and
   * "left" both step to the earlier sibling; "down" and "right" to
   * the later one. If already at the boundary, no-op.
   */
  async moveNode(
    id: string,
    direction: 'up' | 'down' | 'left' | 'right',
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
  }
}

export const orgBoardService = new OrgBoardService()
