'use client'

// Right-side sheet with grouped filters for the Opportunities view.
// State lives in the shell — this component is a controlled editor:
// takes the current draft, lets the user tweak, and calls onApply
// (or onClear) on close. Filtering itself happens client-side in
// the shell against the loaded deals array so pipeline switches
// don't need a round-trip.

import { useState, useEffect } from 'react'
import { CalendarDays, User as UserIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

import type { PipelineStage } from '@/lib/services/crm-pipeline-service'
import type { CrmTeamMember } from '@/app/(admin)/admin/crm/opportunities/actions'

export interface OpportunityFilterState {
  stageIds: string[]
  statuses: Array<'OPEN' | 'WON' | 'LOST'>
  assigneeIds: string[]
  /** Empty string = not set. */
  valueMin: string
  valueMax: string
  /** ISO date string (yyyy-MM-dd) or ''. */
  closeDateFrom: string
  closeDateTo: string
}

export const EMPTY_FILTER: OpportunityFilterState = {
  stageIds: [],
  statuses: [],
  assigneeIds: [],
  valueMin: '',
  valueMax: '',
  closeDateFrom: '',
  closeDateTo: '',
}

/** Count of active facets — powers the toolbar's "Filters (N)" badge. */
export function countActiveFilters(f: OpportunityFilterState): number {
  let n = 0
  if (f.stageIds.length > 0) n++
  if (f.statuses.length > 0) n++
  if (f.assigneeIds.length > 0) n++
  if (f.valueMin || f.valueMax) n++
  if (f.closeDateFrom || f.closeDateTo) n++
  return n
}

interface FilterDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: OpportunityFilterState
  stages: PipelineStage[]
  members: CrmTeamMember[]
  onApply: (next: OpportunityFilterState) => void
}

export function OpportunitiesFilterDrawer({
  open,
  onOpenChange,
  value,
  stages,
  members,
  onApply,
}: FilterDrawerProps) {
  const [draft, setDraft] = useState(value)

  // Re-seed the draft whenever the sheet re-opens so cancels don't
  // leak stale edits into the next session.
  useEffect(() => {
    if (open) setDraft(value)
  }, [open, value])

  function toggleInSet<T>(set: T[], val: T): T[] {
    return set.includes(val) ? set.filter((x) => x !== val) : [...set, val]
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>
            Narrow the board to a slice — filters apply to both the
            Kanban and list views.
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="space-y-6">
          {/* Stage */}
          <FilterGroup title="Stage">
            <div className="flex flex-wrap gap-1.5">
              {stages.map((s) => {
                const active = draft.stageIds.includes(s.id)
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        stageIds: toggleInSet(draft.stageIds, s.id),
                      })
                    }
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                      active
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-input text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <span
                      aria-hidden
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.name}
                  </button>
                )
              })}
            </div>
          </FilterGroup>

          {/* Status */}
          <FilterGroup title="Status">
            <div className="flex gap-1.5">
              {(['OPEN', 'WON', 'LOST'] as const).map((st) => {
                const active = draft.statuses.includes(st)
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        statuses: toggleInSet(draft.statuses, st),
                      })
                    }
                    className={cn(
                      'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                      active
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-input text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {st.charAt(0) + st.slice(1).toLowerCase()}
                  </button>
                )
              })}
            </div>
          </FilterGroup>

          {/* Assignee */}
          <FilterGroup title="Assigned to">
            <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
              {members.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No team members yet.
                </p>
              ) : (
                members.map((m) => (
                  <label
                    key={m.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent/40"
                  >
                    <Checkbox
                      checked={draft.assigneeIds.includes(m.id)}
                      onCheckedChange={(v) =>
                        setDraft({
                          ...draft,
                          assigneeIds: v
                            ? [...draft.assigneeIds, m.id]
                            : draft.assigneeIds.filter((x) => x !== m.id),
                        })
                      }
                    />
                    <UserIcon
                      className="size-3 text-muted-foreground"
                      aria-hidden
                    />
                    <span className="truncate">{m.name ?? m.email}</span>
                  </label>
                ))
              )}
            </div>
          </FilterGroup>

          {/* Value range */}
          <FilterGroup title="Value (USD)">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="filter-val-min" className="text-xs">
                  Min
                </Label>
                <Input
                  id="filter-val-min"
                  type="number"
                  min={0}
                  step="1"
                  value={draft.valueMin}
                  onChange={(e) =>
                    setDraft({ ...draft, valueMin: e.target.value })
                  }
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="filter-val-max" className="text-xs">
                  Max
                </Label>
                <Input
                  id="filter-val-max"
                  type="number"
                  min={0}
                  step="1"
                  value={draft.valueMax}
                  onChange={(e) =>
                    setDraft({ ...draft, valueMax: e.target.value })
                  }
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="∞"
                />
              </div>
            </div>
          </FilterGroup>

          {/* Close date range */}
          <FilterGroup title="Close date">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="filter-close-from" className="text-xs">
                  From
                </Label>
                <Input
                  id="filter-close-from"
                  type="date"
                  value={draft.closeDateFrom}
                  onChange={(e) =>
                    setDraft({ ...draft, closeDateFrom: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="filter-close-to" className="text-xs">
                  To
                </Label>
                <Input
                  id="filter-close-to"
                  type="date"
                  value={draft.closeDateTo}
                  onChange={(e) =>
                    setDraft({ ...draft, closeDateTo: e.target.value })
                  }
                />
              </div>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              <CalendarDays className="mr-1 inline size-3" aria-hidden />
              Deals without a close date are excluded when a range is set.
            </p>
          </FilterGroup>
        </SheetBody>

        <SheetFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setDraft(EMPTY_FILTER)
              onApply(EMPTY_FILTER)
              onOpenChange(false)
            }}
          >
            Clear all
          </Button>
          <Button
            onClick={() => {
              onApply(draft)
              onOpenChange(false)
            }}
          >
            Apply filters
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function FilterGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  )
}

/** Client-side filter — applied by the shell to the loaded deals so
 *  applying/clearing a filter is instantaneous. */
export function applyOpportunityFilter<
  T extends {
    stageId: string
    status: 'OPEN' | 'WON' | 'LOST'
    value: number | null
    expectedCloseDate: Date | null
    assignedCloser: { id: string } | null
  },
>(items: T[], f: OpportunityFilterState): T[] {
  const min = f.valueMin ? Number(f.valueMin) : null
  const max = f.valueMax ? Number(f.valueMax) : null
  const fromDate = f.closeDateFrom ? new Date(f.closeDateFrom) : null
  const toDate = f.closeDateTo ? new Date(f.closeDateTo) : null

  return items.filter((it) => {
    if (f.stageIds.length > 0 && !f.stageIds.includes(it.stageId)) return false
    if (f.statuses.length > 0 && !f.statuses.includes(it.status)) return false
    if (
      f.assigneeIds.length > 0 &&
      (!it.assignedCloser || !f.assigneeIds.includes(it.assignedCloser.id))
    )
      return false
    if (min !== null && (it.value === null || it.value < min)) return false
    if (max !== null && (it.value === null || it.value > max)) return false
    if (fromDate !== null || toDate !== null) {
      if (!it.expectedCloseDate) return false
      if (fromDate && it.expectedCloseDate < fromDate) return false
      if (toDate && it.expectedCloseDate > toDate) return false
    }
    return true
  })
}
