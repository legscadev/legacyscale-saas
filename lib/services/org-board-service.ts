import type { OrgNodeKind } from '@prisma/client'

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
  color: string | null
  orderIndex: number
  employee: OrgNodeEmployeeRef | null
  freeTextHolder: string | null
}

export interface OrgBoardTree {
  revision: OrgBoardRevisionSummary
  nodes: OrgNodeRow[]
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
}

export const orgBoardService = new OrgBoardService()
