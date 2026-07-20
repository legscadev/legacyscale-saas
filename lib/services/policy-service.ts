// Policy CRUD + list/filter for the Policies module.
//
// The service owns the write path for Policy rows, its revision
// snapshots on publish, and archive/restore/soft-delete transitions.
// Attachment writes live in policy-attachment-service; activity logs
// in policy-activity-service. Comments are intentionally out-of-
// scope for Phase 1 (policies are reference docs, not discussion
// surfaces).
//
// Tenant scoping is handled by the Prisma extension for top-level
// operations. The publish + revert flows run inside interactive
// transactions with a bumped timeout — the pooler's default 5s
// isn't enough headroom for the read+snapshot+update sequence.

import type { Policy, Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { policyActivityService } from '@/lib/services/policy-activity-service'
import { getRequestCompanyId } from '@/lib/tenancy/request-company'
import type {
  CreatePolicyOutput,
  PolicyFilterOutput,
  UpdatePolicyOutput,
} from '@/lib/validations/policy'

/**
 * Per-service not-found sentinel. Action handlers branch on
 * `instanceof PolicyNotFoundError` to return a 404-shaped response.
 */
export class PolicyNotFoundError extends Error {
  constructor(message = 'Policy not found') {
    super(message)
    this.name = 'PolicyNotFoundError'
  }
}

/** Raised when a revert points at a revision that belongs to a
 *  different policy. Guards against stale form state after an admin
 *  navigates between policies. */
export class RevisionMismatchError extends Error {
  constructor(message = 'Revision does not belong to this policy') {
    super(message)
    this.name = 'RevisionMismatchError'
  }
}

// ============================================
// PUBLIC SHAPES
// ============================================

export interface PolicyUserRef {
  id: string
  name: string | null
  email: string
}

/** Row shape for the list view. Serializable — no methods, no
 *  Prisma-native types leak out. */
export interface PolicyListItem {
  id: string
  title: string
  status: Policy['status']
  revision: number
  categoryId: string | null
  category: { id: string; name: string; color: string } | null
  createdByUser: PolicyUserRef | null
  updatedByUser: PolicyUserRef | null
  publishedAt: Date | null
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
  attachmentCount: number
  revisionCount: number
}

/** Full detail — same as list plus the body content. Revisions +
 *  attachments themselves come from their own services on demand. */
export interface PolicyDetail extends PolicyListItem {
  body: string | null
}

export interface PolicyListResult {
  items: PolicyListItem[]
  total: number
  page: number
  limit: number
  totalPages: number
  hasMore: boolean
}

export interface PolicyRevisionRow {
  id: string
  policyId: string
  revision: number
  title: string
  publishedAt: Date
  publishedBy: PolicyUserRef | null
}

export interface PolicyRevisionDetail extends PolicyRevisionRow {
  body: string | null
}

// ============================================
// PRIVATE HELPERS
// ============================================

const POLICY_LIST_INCLUDE = {
  category: { select: { id: true, name: true, color: true } },
  createdByUser: { select: { id: true, name: true, email: true } },
  updatedByUser: { select: { id: true, name: true, email: true } },
  _count: { select: { attachments: true, revisions: true } },
} as const satisfies Prisma.PolicyInclude

type PolicyListRow = Prisma.PolicyGetPayload<{
  include: typeof POLICY_LIST_INCLUDE
}>

function mapListRow(p: PolicyListRow): PolicyListItem {
  return {
    id: p.id,
    title: p.title,
    status: p.status,
    revision: p.revision,
    categoryId: p.categoryId,
    category: p.category,
    createdByUser: p.createdByUser,
    updatedByUser: p.updatedByUser,
    publishedAt: p.publishedAt,
    archivedAt: p.archivedAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    attachmentCount: p._count.attachments,
    revisionCount: p._count.revisions,
  }
}

function mapDetail(p: PolicyListRow & { body: string | null }): PolicyDetail {
  return { ...mapListRow(p), body: p.body }
}

async function requireCompanyId(): Promise<string> {
  const id = await getRequestCompanyId()
  if (!id) {
    throw new Error('policy-service: no active company in request context')
  }
  return id
}

// ============================================
// SERVICE
// ============================================

class PolicyService {
  /**
   * Paginated list with filters. Sort is server-side. `search`
   * matches title ILIKE %q% — HTML bodies are skipped to avoid
   * noisy matches on tag names + inline styles.
   */
  async list(filters: PolicyFilterOutput): Promise<PolicyListResult> {
    const { page, limit, sortBy, sortOrder, includeArchived } = filters
    const skip = (page - 1) * limit

    const where: Prisma.PolicyWhereInput = {
      deletedAt: null,
      ...(includeArchived ? {} : { archivedAt: null }),
    }

    if (filters.search?.trim()) {
      where.title = { contains: filters.search.trim(), mode: 'insensitive' }
    }
    if (filters.statuses?.length) {
      where.status = { in: filters.statuses }
    }
    if (filters.categoryIds?.length) {
      where.categoryId = { in: filters.categoryIds }
    }

    const orderBy: Prisma.PolicyOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    }

    const [rows, total] = await Promise.all([
      prisma.policy.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: POLICY_LIST_INCLUDE,
      }),
      prisma.policy.count({ where }),
    ])

    const totalPages = Math.ceil(total / limit)
    return {
      items: rows.map(mapListRow),
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
    }
  }

  async get(id: string): Promise<PolicyDetail> {
    const p = await prisma.policy.findFirst({
      where: { id, deletedAt: null },
      include: POLICY_LIST_INCLUDE,
    })
    if (!p) throw new PolicyNotFoundError()
    return mapDetail(p)
  }

  async create(
    input: CreatePolicyOutput,
    actorId: string | null,
  ): Promise<PolicyDetail> {
    await requireCompanyId()

    const created = await prisma.policy.create({
      data: {
        title: input.title,
        body: input.body ?? null,
        categoryId: input.categoryId ?? null,
        createdBy: actorId,
        updatedBy: actorId,
      },
      select: { id: true },
    })

    await policyActivityService.logEvent({
      policyId: created.id,
      actorId,
      action: 'created',
      toValue: {
        title: input.title,
        categoryId: input.categoryId ?? null,
      },
    })

    return this.get(created.id)
  }

  /**
   * Partial update. Explicit null clears body / category. Editing
   * does NOT bump the revision counter — only publish() cuts a new
   * revision. Callers should publish afterwards if they want the
   * change visible to the frozen-snapshot audience.
   */
  async update(
    id: string,
    input: UpdatePolicyOutput,
    actorId: string | null,
  ): Promise<PolicyDetail> {
    const existing = await prisma.policy.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, title: true, categoryId: true },
    })
    if (!existing) throw new PolicyNotFoundError()

    const data: Prisma.PolicyUncheckedUpdateInput = { updatedBy: actorId }
    if (input.title !== undefined) data.title = input.title
    if (input.body !== undefined) data.body = input.body
    if (input.categoryId !== undefined) data.categoryId = input.categoryId

    await prisma.policy.update({ where: { id }, data })

    await policyActivityService.logEvent({
      policyId: id,
      actorId,
      action: 'updated',
      fromValue: {
        title: existing.title,
        categoryId: existing.categoryId,
      },
      toValue: {
        title: input.title ?? existing.title,
        categoryId:
          input.categoryId === undefined
            ? existing.categoryId
            : input.categoryId,
      },
    })

    return this.get(id)
  }

  /**
   * Snapshot the current body into a PolicyRevision, bump the
   * revision counter, transition status to PUBLISHED, and stamp
   * publishedAt on first publish. Re-publish (from PUBLISHED) is
   * allowed — the caller has just edited the current body and wants
   * a fresh revision cut.
   *
   * Runs inside an interactive transaction so the snapshot + counter
   * bump can't race. Timeout bumped from Prisma's default 5s because
   * the pooler occasionally spikes to ~3s round-trip.
   */
  async publish(id: string, actorId: string | null): Promise<PolicyDetail> {
    const companyId = await requireCompanyId()

    const detail = await prisma.$transaction(
      async (tx) => {
        const p = await tx.policy.findFirst({
          where: { id, deletedAt: null },
          select: {
            id: true,
            title: true,
            body: true,
            status: true,
            revision: true,
            publishedAt: true,
          },
        })
        if (!p) throw new PolicyNotFoundError()

        const nextRevision = p.revision + 1
        const now = new Date()

        await tx.policyRevision.create({
          data: {
            policyId: id,
            revision: nextRevision,
            title: p.title,
            body: p.body,
            publishedAt: now,
            publishedById: actorId,
            companyId,
          },
        })

        await tx.policy.update({
          where: { id },
          data: {
            status: 'PUBLISHED',
            revision: nextRevision,
            publishedAt: p.publishedAt ?? now,
            updatedBy: actorId,
          },
        })

        await policyActivityService.logEvent({
          policyId: id,
          actorId,
          action: 'published',
          fromValue: { status: p.status, revision: p.revision },
          toValue: { status: 'PUBLISHED', revision: nextRevision },
          tx,
        })

        return id
      },
      { timeout: 15_000 },
    )

    return this.get(detail)
  }

  async archive(id: string, actorId: string | null): Promise<PolicyDetail> {
    const existing = await prisma.policy.findFirst({
      where: { id, deletedAt: null },
      select: { status: true, archivedAt: true },
    })
    if (!existing) throw new PolicyNotFoundError()
    if (existing.archivedAt) return this.get(id)

    await prisma.policy.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        archivedAt: new Date(),
        updatedBy: actorId,
      },
    })
    await policyActivityService.logEvent({
      policyId: id,
      actorId,
      action: 'archived',
      fromValue: { status: existing.status },
      toValue: { status: 'ARCHIVED' },
    })

    return this.get(id)
  }

  /**
   * Restore an archived OR soft-deleted policy. Status returns to
   * PUBLISHED if a revision exists, otherwise DRAFT. That keeps the
   * "un-archive vs undo-delete" flow single-callsite without a
   * separate un-delete method.
   */
  async restore(id: string, actorId: string | null): Promise<PolicyDetail> {
    const existing = await prisma.policy.findFirst({
      where: { id },
      select: {
        status: true,
        archivedAt: true,
        deletedAt: true,
        revision: true,
      },
    })
    if (!existing) throw new PolicyNotFoundError()

    const restoreStatus = existing.revision > 0 ? 'PUBLISHED' : 'DRAFT'

    await prisma.policy.update({
      where: { id },
      data: {
        status: restoreStatus,
        archivedAt: null,
        deletedAt: null,
        updatedBy: actorId,
      },
    })
    await policyActivityService.logEvent({
      policyId: id,
      actorId,
      action: 'restored',
      fromValue: {
        status: existing.status,
        archivedAt: existing.archivedAt,
        deletedAt: existing.deletedAt,
      },
      toValue: { status: restoreStatus },
    })

    return this.get(id)
  }

  /** Soft delete. Reversible via restore() until a hard-purge cron
   *  removes deletedAt-older-than-N rows (not yet built). */
  async softDelete(id: string, actorId: string | null): Promise<void> {
    const existing = await prisma.policy.findFirst({
      where: { id, deletedAt: null },
      select: { status: true },
    })
    if (!existing) throw new PolicyNotFoundError()

    await prisma.policy.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: actorId },
    })
    await policyActivityService.logEvent({
      policyId: id,
      actorId,
      action: 'deleted',
      fromValue: { status: existing.status },
    })
  }

  /**
   * Copy a prior revision's title + body back onto the parent Policy
   * AND cut a new revision from that snapshot so the timeline stays
   * append-only. Same interactive-tx pattern as publish().
   */
  async revert(
    id: string,
    revisionId: string,
    actorId: string | null,
  ): Promise<PolicyDetail> {
    const companyId = await requireCompanyId()

    await prisma.$transaction(
      async (tx) => {
        const [policy, revision] = await Promise.all([
          tx.policy.findFirst({
            where: { id, deletedAt: null },
            select: { id: true, revision: true, publishedAt: true },
          }),
          tx.policyRevision.findUnique({
            where: { id: revisionId },
            select: {
              id: true,
              policyId: true,
              revision: true,
              title: true,
              body: true,
            },
          }),
        ])
        if (!policy) throw new PolicyNotFoundError()
        if (!revision || revision.policyId !== id) {
          throw new RevisionMismatchError()
        }

        const nextRevision = policy.revision + 1
        const now = new Date()

        await tx.policyRevision.create({
          data: {
            policyId: id,
            revision: nextRevision,
            title: revision.title,
            body: revision.body,
            publishedAt: now,
            publishedById: actorId,
            companyId,
          },
        })

        await tx.policy.update({
          where: { id },
          data: {
            title: revision.title,
            body: revision.body,
            status: 'PUBLISHED',
            revision: nextRevision,
            publishedAt: policy.publishedAt ?? now,
            updatedBy: actorId,
          },
        })

        await policyActivityService.logEvent({
          policyId: id,
          actorId,
          action: 'reverted_to_revision',
          fromValue: { revision: policy.revision },
          toValue: {
            revision: nextRevision,
            revertedFrom: revision.revision,
          },
          tx,
        })
      },
      { timeout: 15_000 },
    )

    return this.get(id)
  }

  // -------- REVISIONS (read) --------

  async listRevisions(policyId: string): Promise<PolicyRevisionRow[]> {
    const rows = await prisma.policyRevision.findMany({
      where: { policyId },
      orderBy: { revision: 'desc' },
      include: {
        publishedBy: { select: { id: true, name: true, email: true } },
      },
    })
    return rows.map((r) => ({
      id: r.id,
      policyId: r.policyId,
      revision: r.revision,
      title: r.title,
      publishedAt: r.publishedAt,
      publishedBy: r.publishedBy,
    }))
  }

  async getRevision(revisionId: string): Promise<PolicyRevisionDetail> {
    const r = await prisma.policyRevision.findUnique({
      where: { id: revisionId },
      include: {
        publishedBy: { select: { id: true, name: true, email: true } },
      },
    })
    if (!r) throw new PolicyNotFoundError('Revision not found')
    return {
      id: r.id,
      policyId: r.policyId,
      revision: r.revision,
      title: r.title,
      body: r.body,
      publishedAt: r.publishedAt,
      publishedBy: r.publishedBy,
    }
  }
}

export const policyService = new PolicyService()
