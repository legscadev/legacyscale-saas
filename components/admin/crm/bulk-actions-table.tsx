'use client'

// History table for the Bulk Actions tab. Purely a read view of the
// crm_bulk_actions log — filtering is deferred to a later cut so we
// ship the audit trail first. Server pagination is passed through
// so the table can grow without lifting the whole log into the
// browser.

import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

import { AvatarGroup } from '@/components/shared/avatar-group'
import { EmptyState } from '@/components/shared/empty-state'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

import type { BulkActionLogRow } from '@/lib/services/crm-bulk-action-service'

const OPERATION_LABELS: Record<BulkActionLogRow['operation'], string> = {
  DELETE: 'Delete',
  MOVE_STAGE: 'Move stage',
  // Enum key stays ASSIGN_CLOSER (schema); label is role-agnostic
  // since either a setter or a closer can be assigned.
  ASSIGN_CLOSER: 'Assign',
}

const STATUS_STYLES: Record<BulkActionLogRow['status'], string> = {
  RUNNING:
    'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300',
  COMPLETE:
    'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300',
  FAILED:
    'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300',
}

function formatDate(date: Date | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface BulkActionsTableProps {
  rows: BulkActionLogRow[]
  total: number
  page: number
  limit: number
}

export function BulkActionsTable({
  rows,
  total,
  page,
  limit,
}: BulkActionsTableProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        tone="neutral"
        title="No bulk actions yet"
        description="Bulk deletes and edits will show up here once you run them."
      />
    )
  }

  const start = (page - 1) * limit + 1
  const end = Math.min(page * limit, total)

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action label</TableHead>
              <TableHead className="w-32">Operation</TableHead>
              <TableHead className="w-32">Status</TableHead>
              <TableHead className="w-48">User</TableHead>
              <TableHead className="w-40">Created</TableHead>
              <TableHead className="w-40">Completed</TableHead>
              <TableHead className="w-32 text-right">Statistics</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {OPERATION_LABELS[row.operation]}
                </TableCell>
                <TableCell>
                  <StatusPill status={row.status} />
                </TableCell>
                <TableCell>
                  {row.actor ? (
                    <div className="flex items-center gap-2">
                      <AvatarGroup
                        users={[
                          {
                            name: row.actor.name ?? row.actor.email,
                            avatarUrl: row.actor.avatarUrl,
                          },
                        ]}
                        size="sm"
                        max={1}
                      />
                      <span className="line-clamp-1 text-sm">
                        {row.actor.name ?? row.actor.email}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Unknown
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(row.createdAt)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(row.completedAt)}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  <Statistics row={row} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing {start}–{end} of {total}
        </span>
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: BulkActionLogRow['status'] }) {
  const Icon = status === 'RUNNING' ? Loader2 : status === 'FAILED' ? AlertCircle : CheckCircle2
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        STATUS_STYLES[status],
      )}
    >
      <Icon
        aria-hidden
        className={cn('size-3', status === 'RUNNING' && 'animate-spin')}
      />
      {status === 'RUNNING'
        ? 'In progress'
        : status === 'FAILED'
          ? 'Failed'
          : 'Complete'}
    </span>
  )
}

function Statistics({ row }: { row: BulkActionLogRow }) {
  const { successCount, failureCount, targetCount } = row
  if (row.status === 'RUNNING') {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <span className="inline-flex items-center gap-2">
      <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[10px]">
        {successCount}/{targetCount}
      </Badge>
      {failureCount > 0 ? (
        <span className="text-rose-600">{failureCount} failed</span>
      ) : null}
    </span>
  )
}
