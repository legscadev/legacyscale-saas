// Executes bulk operations against CRM entities and logs each run to
// crm_bulk_actions so the /bulk-actions history tab can render an
// audit trail. Runs synchronously for P0 — every job flips COMPLETE
// or FAILED before returning. The RUNNING status is kept so a later
// async worker (queue-driven) can adopt the same schema without a
// migration.

import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

export interface BulkActionLogRow {
  id: string
  label: string
  operation: 'DELETE' | 'MOVE_STAGE' | 'ASSIGN_CLOSER'
  targetType: 'OPPORTUNITY' | 'LEAD' | 'CONTACT'
  status: 'RUNNING' | 'COMPLETE' | 'FAILED'
  targetCount: number
  successCount: number
  failureCount: number
  errorMessage: string | null
  createdAt: Date
  completedAt: Date | null
  actor: {
    id: string
    name: string | null
    email: string
    avatarUrl: string | null
  } | null
}

/** Filters accepted by the history table's toolbar. */
export interface BulkActionListFilters {
  from?: Date
  to?: Date
  statuses?: Array<'RUNNING' | 'COMPLETE' | 'FAILED'>
  operations?: Array<'DELETE' | 'MOVE_STAGE' | 'ASSIGN_CLOSER'>
  actorIds?: string[]
  page?: number
  limit?: number
}

const DEFAULT_LIMIT = 50

/** Auto-generated action label — matches HighLevel's convention
 *  ("Delete - 5_Sep_2026_12_28_AM"). Timezone-free UTC read so two
 *  operators looking at the same log see the same label. */
function generateLabel(operation: string, when: Date): string {
  const iso = when.toISOString()
  // 2026-07-29T18:22:31.000Z → 29_Jul_2026_18_22_UTC
  const [date, timePart] = iso.split('T')
  const [year, month, day] = date!.split('-')
  const monthShort = new Date(when).toLocaleString('en', { month: 'short' })
  const [hh, mm] = timePart!.split(':')
  return `${OPERATION_LABELS[operation as keyof typeof OPERATION_LABELS] ?? operation} - ${day}_${monthShort}_${year}_${hh}_${mm}_UTC`
}

const OPERATION_LABELS = {
  DELETE: 'Delete',
  MOVE_STAGE: 'Move stage',
  // Enum key stays ASSIGN_CLOSER (schema); label is role-agnostic
  // — either a setter or a closer can be assigned to a deal.
  ASSIGN_CLOSER: 'Assign',
} as const

class CrmBulkActionService {
  /** Paginated fetch for the Bulk Actions history table. Tenancy is
   *  enforced by the request-company Prisma extension. */
  async list(
    filters: BulkActionListFilters,
  ): Promise<{ rows: BulkActionLogRow[]; total: number }> {
    const page = filters.page ?? 1
    const limit = filters.limit ?? DEFAULT_LIMIT
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (filters.from || filters.to) {
      const range: Record<string, Date> = {}
      if (filters.from) range.gte = filters.from
      if (filters.to) range.lte = filters.to
      where.createdAt = range
    }
    if (filters.statuses?.length) where.status = { in: filters.statuses }
    if (filters.operations?.length)
      where.operation = { in: filters.operations }
    if (filters.actorIds?.length) where.actorId = { in: filters.actorIds }

    const [rows, total] = await Promise.all([
      prisma.crmBulkAction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          label: true,
          operation: true,
          targetType: true,
          status: true,
          targetCount: true,
          successCount: true,
          failureCount: true,
          errorMessage: true,
          createdAt: true,
          completedAt: true,
          actor: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      }),
      prisma.crmBulkAction.count({ where }),
    ])

    return { rows: rows as BulkActionLogRow[], total }
  }

  /**
   * Soft-delete every non-deleted opportunity in `opportunityIds`.
   * Runs sequentially so a single row's failure only stops itself —
   * the others still count as successes.
   */
  async bulkDeleteOpportunities(input: {
    opportunityIds: string[]
    actorId: string | null
  }): Promise<BulkActionLogRow> {
    return runBulk({
      operation: 'DELETE',
      opportunityIds: input.opportunityIds,
      actorId: input.actorId,
      params: { opportunityIds: input.opportunityIds },
      // Soft-delete + close the deal so counters ignore it. Skip rows
      // that are already deleted so re-running the job is a no-op
      // instead of an error.
      perRow: async (id) => {
        const res = await prisma.crmOpportunity.updateMany({
          where: { id, deletedAt: null },
          data: { deletedAt: new Date(), status: 'LOST' },
        })
        return res.count > 0
          ? { ok: true }
          : { ok: false, error: `Deal ${id} was already deleted` }
      },
    })
  }

  /**
   * Move every deal in `opportunityIds` into `stageId`. Sequential so
   * one bad row doesn't scuttle the batch. Places moved deals at the
   * end of the target column (orderIndex = last + 100).
   */
  async bulkMoveOpportunitiesToStage(input: {
    opportunityIds: string[]
    stageId: string
    actorId: string | null
  }): Promise<BulkActionLogRow> {
    const { opportunityIds, stageId, actorId } = input

    // Resolve the stage once — mid-loop lookups add a query per row.
    const stage = await prisma.crmPipelineStage.findFirst({
      where: { id: stageId },
      select: { id: true, isWon: true, isLost: true, probability: true },
    })
    if (!stage) throw new Error('Target stage not found')

    return runBulk({
      operation: 'MOVE_STAGE',
      opportunityIds,
      actorId,
      params: { opportunityIds, stageId },
      perRow: async (id, index) => {
        // orderIndex grows with the batch position so moved deals
        // stack in the same relative order at the bottom of the col.
        const last = await prisma.crmOpportunity.findFirst({
          where: { stageId: stage.id, deletedAt: null },
          orderBy: { orderIndex: 'desc' },
          select: { orderIndex: true },
        })
        const newOrder = (last?.orderIndex ?? 0) + 100 + index

        const res = await prisma.crmOpportunity.updateMany({
          where: { id, deletedAt: null },
          data: {
            stageId: stage.id,
            orderIndex: newOrder,
            // Match single-move semantics: land in Won/Lost → flip
            // status; otherwise leave status alone.
            ...(stage.isWon
              ? { status: 'WON', wonAt: new Date() }
              : stage.isLost
                ? { status: 'LOST', lostAt: new Date() }
                : {}),
          },
        })
        return res.count > 0
          ? { ok: true }
          : { ok: false, error: `Deal ${id} not found or already deleted` }
      },
    })
  }

  /**
   * Assign (or unassign — pass null) a closer to every deal in
   * `opportunityIds`.
   */
  async bulkAssignCloser(input: {
    opportunityIds: string[]
    closerId: string | null
    actorId: string | null
  }): Promise<BulkActionLogRow> {
    const { opportunityIds, closerId, actorId } = input
    return runBulk({
      operation: 'ASSIGN_CLOSER',
      opportunityIds,
      actorId,
      params: { opportunityIds, closerId },
      perRow: async (id) => {
        const res = await prisma.crmOpportunity.updateMany({
          where: { id, deletedAt: null },
          data: { assignedCloserId: closerId },
        })
        return res.count > 0
          ? { ok: true }
          : { ok: false, error: `Deal ${id} not found or already deleted` }
      },
    })
  }
}

/** Shared log-lifecycle for every bulk operation. Creates a RUNNING
 *  row, runs `perRow` for each id, then flips the log to
 *  COMPLETE/FAILED with counts. Kept private so callers can't
 *  bypass logging. */
async function runBulk(input: {
  operation: 'DELETE' | 'MOVE_STAGE' | 'ASSIGN_CLOSER'
  opportunityIds: string[]
  actorId: string | null
  params: Prisma.InputJsonValue
  perRow: (id: string, index: number) => Promise<{ ok: boolean; error?: string }>
}): Promise<BulkActionLogRow> {
  const log = await prisma.crmBulkAction.create({
    data: {
      label: generateLabel(input.operation, new Date()),
      operation: input.operation,
      targetType: 'OPPORTUNITY',
      status: 'RUNNING',
      targetCount: input.opportunityIds.length,
      params: input.params,
      actorId: input.actorId,
    },
  })

  let successCount = 0
  let failureCount = 0
  let firstError: string | null = null

  for (let i = 0; i < input.opportunityIds.length; i++) {
    const id = input.opportunityIds[i]!
    try {
      const res = await input.perRow(id, i)
      if (res.ok) successCount++
      else {
        failureCount++
        if (firstError === null && res.error) firstError = res.error
      }
    } catch (err) {
      failureCount++
      if (firstError === null) {
        firstError = err instanceof Error ? err.message : 'Unknown error'
      }
    }
  }

  const finalStatus =
    failureCount > 0 && successCount === 0 ? 'FAILED' : 'COMPLETE'

  const updated = await prisma.crmBulkAction.update({
    where: { id: log.id },
    data: {
      status: finalStatus,
      successCount,
      failureCount,
      errorMessage: firstError,
      completedAt: new Date(),
    },
    select: {
      id: true,
      label: true,
      operation: true,
      targetType: true,
      status: true,
      targetCount: true,
      successCount: true,
      failureCount: true,
      errorMessage: true,
      createdAt: true,
      completedAt: true,
      actor: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
    },
  })
  return updated as BulkActionLogRow
}

export const crmBulkActionService = new CrmBulkActionService()
