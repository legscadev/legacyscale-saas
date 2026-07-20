// Immutable audit surface for every mutation on a policy. Every
// write path in the module calls logEvent() with a short verb tag +
// optional from/to JSON snapshots; the detail view's activity
// timeline (Phase 5) reads from this table.
//
// Kept as a thin write API plus a paginated read. The renderer
// sits in the UI layer — it switches on `action` to build the
// sentence, so this file stays free of presentation concerns.

import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

/**
 * Canonical verbs. Extend as new mutation shapes land. Keep them
 * short and past-tense — they double as i18n keys later.
 */
export type PolicyActivityAction =
  | 'created'
  | 'updated'
  | 'published'
  | 'archived'
  | 'restored'
  | 'deleted'
  | 'reverted_to_revision'
  | 'category_changed'
  | 'attachment_added'
  | 'attachment_removed'

export interface PolicyActivityRow {
  id: string
  policyId: string
  actor: { id: string; name: string | null; email: string } | null
  action: PolicyActivityAction
  fromValue: unknown
  toValue: unknown
  createdAt: Date
}

export interface LogEventInput {
  policyId: string
  actorId: string | null
  action: PolicyActivityAction
  fromValue?: unknown
  toValue?: unknown
  /**
   * Optional transaction handle. Callers running inside a
   * $transaction can pass tx here so the log write commits atomically
   * with the mutation it describes.
   */
  tx?: Prisma.TransactionClient
}

const ACTIVITY_INCLUDE = {
  actor: { select: { id: true, name: true, email: true } },
} as const satisfies Prisma.PolicyActivityLogInclude

type ActivityWithIncludes = Prisma.PolicyActivityLogGetPayload<{
  include: typeof ACTIVITY_INCLUDE
}>

function mapRow(row: ActivityWithIncludes): PolicyActivityRow {
  return {
    id: row.id,
    policyId: row.policyId,
    actor: row.actor,
    action: row.action as PolicyActivityAction,
    fromValue: row.fromValue,
    toValue: row.toValue,
    createdAt: row.createdAt,
  }
}

class PolicyActivityService {
  /**
   * Write one activity row. The tenancy extension stamps companyId.
   * Prefer passing `tx` when the surrounding mutation is
   * transactional so the log survives or rolls back atomically.
   */
  async logEvent(input: LogEventInput): Promise<void> {
    const client = input.tx ?? prisma
    await client.policyActivityLog.create({
      data: {
        policyId: input.policyId,
        actorId: input.actorId,
        action: input.action,
        fromValue:
          input.fromValue === undefined
            ? Prisma.JsonNull
            : (input.fromValue as Prisma.InputJsonValue),
        toValue:
          input.toValue === undefined
            ? Prisma.JsonNull
            : (input.toValue as Prisma.InputJsonValue),
      },
    })
  }

  /**
   * Newest-first activity for a single policy. Paginated because the
   * timeline grows unboundedly on long-lived policies.
   */
  async listForPolicy(
    policyId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<{ items: PolicyActivityRow[]; total: number; hasMore: boolean }> {
    const page = options.page ?? 1
    const limit = options.limit ?? 50
    const skip = (page - 1) * limit

    const [rows, total] = await Promise.all([
      prisma.policyActivityLog.findMany({
        where: { policyId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: ACTIVITY_INCLUDE,
      }),
      prisma.policyActivityLog.count({ where: { policyId } }),
    ])

    return {
      items: rows.map(mapRow),
      total,
      hasMore: page * limit < total,
    }
  }
}

export const policyActivityService = new PolicyActivityService()
