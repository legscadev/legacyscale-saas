'use client'

// List-view table for /admin/policies. Read-only presentation —
// row actions land in Phase 2.4, click-to-open-detail in Phase 3.
//
// Sorting is server-side (URL-driven). Clicking a sortable header
// replays the fetch with the new sort; the shell owns that plumbing
// and this component just emits onSortChange.

import { ArrowUpDown, BookText, Paperclip } from 'lucide-react'

import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { fmtCalendarDateShort, relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'

import type { PolicyListItem } from '@/lib/services/policy-service'

import {
  CategoryChip,
  PolicyStatusPill,
  RevisionBadge,
} from './policy-pills'
import { PolicyRowActions } from './policy-row-actions'

type SortField = 'title' | 'createdAt' | 'updatedAt' | 'publishedAt'
type SortDir = 'asc' | 'desc'

interface PoliciesTableProps {
  items: PolicyListItem[]
  sortBy: SortField
  sortOrder: SortDir
  onSortChange: (field: SortField) => void
  onOpenPolicy?: (id: string) => void
  onCreate?: () => void
  /** Called after any row-action mutation completes so the shell
   *  can refresh the workspace. */
  onRowChanged: () => void | Promise<void>
  /** When false, the row-actions column is hidden and the empty
   *  state omits the Create button. Set by the TEAM read view. */
  canWrite?: boolean
}

export function PoliciesTable({
  items,
  sortBy,
  sortOrder,
  onSortChange,
  onOpenPolicy,
  onCreate,
  onRowChanged,
  canWrite = true,
}: PoliciesTableProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={BookText}
        title="No policies match these filters"
        description="Try broadening the filter set or draft a new policy."
      >
        {canWrite && onCreate ? (
          <Button onClick={onCreate}>New policy</Button>
        ) : null}
      </EmptyState>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead
              field="title"
              current={sortBy}
              dir={sortOrder}
              onSortChange={onSortChange}
            >
              Title
            </SortableHead>
            <TableHead className="w-40">Category</TableHead>
            <TableHead className="w-28">Status</TableHead>
            <TableHead className="w-20">Revision</TableHead>
            <SortableHead
              field="updatedAt"
              current={sortBy}
              dir={sortOrder}
              onSortChange={onSortChange}
              className="w-32"
            >
              Updated
            </SortableHead>
            <TableHead className="w-20 text-right">Meta</TableHead>
            {canWrite ? (
              <TableHead className="w-10" aria-label="Actions" />
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((policy) => (
            <TableRow
              key={policy.id}
              className={cn(
                onOpenPolicy &&
                  'cursor-pointer transition-colors hover:bg-muted/50',
              )}
              onClick={
                onOpenPolicy ? () => onOpenPolicy(policy.id) : undefined
              }
            >
              <TableCell className="min-w-0">
                <div className="flex flex-col gap-0.5">
                  <p className="line-clamp-1 font-medium text-foreground">
                    {policy.title}
                  </p>
                  {policy.updatedByUser ? (
                    <p className="text-[11px] text-muted-foreground">
                      Last edited by{' '}
                      {policy.updatedByUser.name ??
                        policy.updatedByUser.email.split('@')[0]}
                    </p>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                {policy.category ? (
                  <CategoryChip
                    name={policy.category.name}
                    color={policy.category.color}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <PolicyStatusPill status={policy.status} />
              </TableCell>
              <TableCell>
                <RevisionBadge revision={policy.revision} />
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-foreground">
                    {relativeTime(policy.updatedAt)}
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {fmtCalendarDateShort(policy.updatedAt)}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <MetaSummary policy={policy} />
              </TableCell>
              {canWrite ? (
                <TableCell className="text-right">
                  <PolicyRowActions
                    policy={policy}
                    onChanged={onRowChanged}
                  />
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// =========================================================
// Sortable header cell (same shape as tasks-table's version)
// =========================================================

interface SortableHeadProps {
  field: SortField
  current: SortField
  dir: SortDir
  onSortChange: (field: SortField) => void
  children: React.ReactNode
  className?: string
}

function SortableHead({
  field,
  current,
  dir,
  onSortChange,
  children,
  className,
}: SortableHeadProps) {
  const isActive = current === field
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSortChange(field)}
        className={cn(
          'flex items-center gap-1 text-left text-xs font-medium uppercase tracking-wider transition-colors',
          isActive
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {children}
        <ArrowUpDown
          className={cn(
            'size-3',
            isActive ? 'text-foreground' : 'opacity-40',
            isActive && dir === 'asc' && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
    </TableHead>
  )
}

function MetaSummary({ policy }: { policy: PolicyListItem }) {
  const hasMeta = policy.attachmentCount > 0 || policy.revisionCount > 0
  if (!hasMeta) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  return (
    <div className="flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
      {policy.attachmentCount > 0 ? (
        <span className="inline-flex items-center gap-0.5">
          <Paperclip className="size-3" aria-hidden />
          {policy.attachmentCount}
        </span>
      ) : null}
      {policy.revisionCount > 0 ? (
        <span className="inline-flex items-center gap-0.5 tabular-nums">
          <BookText className="size-3" aria-hidden />
          {policy.revisionCount}
        </span>
      ) : null}
    </div>
  )
}
