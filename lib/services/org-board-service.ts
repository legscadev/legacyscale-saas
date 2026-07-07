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
}

export const orgBoardService = new OrgBoardService()
