'use client'

// Compact table view of pipeline deals — the alternative to the
// Kanban board. Same OpportunityListItem shape, same stage colour
// pill, but rendered as scannable rows for large pipelines where the
// board's card density gets in the way. Row click → open the deal
// edit dialog (same handler the board uses). Row-level checkbox +
// header checkbox drive the shared multi-select state.

import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AvatarGroup } from '@/components/shared/avatar-group'
import { EmptyState } from '@/components/shared/empty-state'
import { fmtCalendarDateShort } from '@/lib/format'
import { cn } from '@/lib/utils'

import type { OpportunityListItem } from '@/lib/services/crm-opportunity-service'
import type { PipelineStage } from '@/lib/services/crm-pipeline-service'

import { formatDealValue } from './opportunity-card'
import { KanbanSquare } from 'lucide-react'

interface OpportunitiesListViewProps {
  stages: PipelineStage[]
  opportunities: OpportunityListItem[]
  selectedIds: Set<string>
  onToggleSelect: (id: string, next: boolean) => void
  onToggleAll: (next: boolean) => void
  onOpen: (id: string) => void
}

export function OpportunitiesListView({
  stages,
  opportunities,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  onOpen,
}: OpportunitiesListViewProps) {
  const stageById = new Map(stages.map((s) => [s.id, s]))

  if (opportunities.length === 0) {
    return (
      <EmptyState
        icon={KanbanSquare}
        tone="neutral"
        title="No deals to show"
        description="Add a deal from the board view or import your existing pipeline."
      />
    )
  }

  const allSelected = opportunities.every((o) => selectedIds.has(o.id))
  const someSelected = !allSelected && opportunities.some((o) => selectedIds.has(o.id))

  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onCheckedChange={(v) => onToggleAll(Boolean(v))}
                aria-label="Select all deals"
              />
            </TableHead>
            <TableHead>Deal</TableHead>
            <TableHead className="w-40">Contact</TableHead>
            <TableHead className="w-40">Stage</TableHead>
            <TableHead className="w-28 text-right">Value</TableHead>
            <TableHead className="w-20 text-right">Prob.</TableHead>
            <TableHead className="w-32">Close date</TableHead>
            <TableHead className="w-32">Owner</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {opportunities.map((opp) => {
            const stage = stageById.get(opp.stageId)
            const isSelected = selectedIds.has(opp.id)
            const value = formatDealValue(opp.value)
            const closer = opp.assignedCloser
            const contact = opp.contactName ?? opp.companyName ?? '—'

            return (
              <TableRow
                key={opp.id}
                data-state={isSelected ? 'selected' : undefined}
                className="cursor-pointer"
                onClick={(e) => {
                  // Don't trigger the row-open when clicking the checkbox.
                  const target = e.target as HTMLElement
                  if (target.closest('[role="checkbox"]')) return
                  onOpen(opp.id)
                }}
              >
                <TableCell
                  className="w-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(v) => onToggleSelect(opp.id, Boolean(v))}
                    aria-label={`Select ${opp.name}`}
                  />
                </TableCell>
                <TableCell className="font-medium">{opp.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  <span className="line-clamp-1">{contact}</span>
                </TableCell>
                <TableCell>
                  {stage ? (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
                      )}
                      style={{
                        backgroundColor: `${stage.color}1a`,
                        color: stage.color,
                      }}
                    >
                      <span
                        aria-hidden
                        className="size-1.5 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      {stage.name}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {value ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  {opp.probability !== null ? (
                    `${opp.probability}%`
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {opp.expectedCloseDate
                    ? fmtCalendarDateShort(opp.expectedCloseDate)
                    : '—'}
                </TableCell>
                <TableCell>
                  {closer ? (
                    <div className="flex items-center gap-2">
                      <AvatarGroup
                        users={[
                          {
                            name: closer.name ?? closer.email,
                            avatarUrl: closer.avatarUrl,
                          },
                        ]}
                        size="sm"
                        max={1}
                      />
                      <span className="line-clamp-1 text-xs text-muted-foreground">
                        {closer.name ?? closer.email}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Unassigned
                    </span>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
