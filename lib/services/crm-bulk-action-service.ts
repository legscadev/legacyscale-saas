// Executes bulk operations against CRM entities and logs each run to
// crm_bulk_actions so the /bulk-actions history tab can render an
// audit trail. Runs synchronously for P0 — every job flips COMPLETE
// or FAILED before returning. The RUNNING status is kept so a later
// async worker (queue-driven) can adopt the same schema without a
// migration.

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
  ASSIGN_CLOSER: 'Assign closer',
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
   * Soft-delete every non-deleted opportunity in `opportunityIds` and
   * log the run. Runs sequentially (small batches) so a single row
   * failure only stops itself — the others still count as successes.
   * The returned row is what the toolbar shows in a toast.
   */
  async bulkDeleteOpportunities(input: {
    opportunityIds: string[]
    actorId: string | null
  }): Promise<BulkActionLogRow> {
    const { opportunityIds, actorId } = input
    const now = new Date()
    const label = generateLabel('DELETE', now)

    const log = await prisma.crmBulkAction.create({
      data: {
        label,
        operation: 'DELETE',
        targetType: 'OPPORTUNITY',
        status: 'RUNNING',
        targetCount: opportunityIds.length,
        params: { opportunityIds },
        actorId,
      },
    })

    let successCount = 0
    let failureCount = 0
    let firstError: string | null = null

    for (const id of opportunityIds) {
      try {
        // Soft-delete + close the deal so counters ignore it. Skip
        // rows that are already deleted so re-running the job is a
        // no-op instead of an error.
        const result = await prisma.crmOpportunity.updateMany({
          where: { id, deletedAt: null },
          data: { deletedAt: new Date(), status: 'LOST' },
        })
        if (result.count === 0) {
          failureCount++
          if (firstError === null) firstError = `Deal ${id} was already deleted`
        } else {
          successCount++
        }
      } catch (err) {
        failureCount++
        if (firstError === null) {
          firstError = err instanceof Error ? err.message : 'Unknown error'
        }
      }
    }

    const finalStatus =
      failureCount === 0
        ? 'COMPLETE'
        : successCount === 0
          ? 'FAILED'
          : 'COMPLETE'

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
}

export const crmBulkActionService = new CrmBulkActionService()
