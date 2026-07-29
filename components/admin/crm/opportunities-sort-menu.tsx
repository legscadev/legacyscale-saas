'use client'

// Sort dropdown for the Opportunities list view. Purely presentational
// — the shell holds sortBy/sortOrder state and hands it to the list
// view, which sorts client-side. Kanban is not affected (deals there
// are always ordered by orderIndex so drag-drop stays authoritative).

import { ArrowDownAZ, ArrowUpAZ, ArrowUpDown, Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export type OpportunitySortBy =
  | 'orderIndex'
  | 'name'
  | 'value'
  | 'probability'
  | 'expectedCloseDate'
export type OpportunitySortOrder = 'asc' | 'desc'

export const OPPORTUNITY_SORT_LABELS: Record<OpportunitySortBy, string> = {
  orderIndex: 'Manual',
  name: 'Deal name',
  value: 'Value',
  probability: 'Probability',
  expectedCloseDate: 'Close date',
}

interface OpportunitiesSortMenuProps {
  sortBy: OpportunitySortBy
  sortOrder: OpportunitySortOrder
  onChange: (next: {
    sortBy: OpportunitySortBy
    sortOrder: OpportunitySortOrder
  }) => void
}

export function OpportunitiesSortMenu({
  sortBy,
  sortOrder,
  onChange,
}: OpportunitiesSortMenuProps) {
  const activeCount = sortBy === 'orderIndex' ? 0 : 1

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Sort deals"
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn(activeCount > 0 && 'border-primary/50 text-primary')}
          />
        }
      >
        <ArrowUpDown className="size-4" />
        Sort
        {activeCount > 0 ? (
          <span className="ml-1 rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
            {activeCount}
          </span>
        ) : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
        {(Object.keys(OPPORTUNITY_SORT_LABELS) as OpportunitySortBy[]).map(
          (key) => (
            <DropdownMenuItem
              key={key}
              onClick={() =>
                onChange({ sortBy: key, sortOrder: key === sortBy ? sortOrder : 'asc' })
              }
            >
              <Check
                className={cn(
                  'size-4',
                  key === sortBy ? 'opacity-100' : 'opacity-0',
                )}
              />
              {OPPORTUNITY_SORT_LABELS[key]}
            </DropdownMenuItem>
          ),
        )}

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Order</DropdownMenuLabel>
        <DropdownMenuItem
          disabled={sortBy === 'orderIndex'}
          onClick={() => onChange({ sortBy, sortOrder: 'asc' })}
        >
          <ArrowUpAZ
            className={cn(
              'size-4',
              sortOrder === 'asc' && sortBy !== 'orderIndex'
                ? 'opacity-100'
                : 'opacity-30',
            )}
          />
          Ascending
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={sortBy === 'orderIndex'}
          onClick={() => onChange({ sortBy, sortOrder: 'desc' })}
        >
          <ArrowDownAZ
            className={cn(
              'size-4',
              sortOrder === 'desc' && sortBy !== 'orderIndex'
                ? 'opacity-100'
                : 'opacity-30',
            )}
          />
          Descending
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Reusable comparator so the list view + any consumer share behavior. */
export function sortOpportunities<
  T extends {
    name: string
    value: number | null
    probability: number | null
    expectedCloseDate: Date | null
    orderIndex: number
  },
>(items: T[], sortBy: OpportunitySortBy, sortOrder: OpportunitySortOrder): T[] {
  if (sortBy === 'orderIndex') return items
  const dir = sortOrder === 'asc' ? 1 : -1
  const copy = items.slice()
  copy.sort((a, b) => {
    const av = pick(a, sortBy)
    const bv = pick(b, sortBy)
    // Nulls always sink to the bottom regardless of order — a missing
    // close date at the top of "sort by close date desc" would read
    // as broken.
    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1
    if (av < bv) return -1 * dir
    if (av > bv) return 1 * dir
    return 0
  })
  return copy
}

function pick(
  item: {
    name: string
    value: number | null
    probability: number | null
    expectedCloseDate: Date | null
  },
  key: OpportunitySortBy,
): number | string | null {
  switch (key) {
    case 'name':
      return item.name.toLowerCase()
    case 'value':
      return item.value
    case 'probability':
      return item.probability
    case 'expectedCloseDate':
      return item.expectedCloseDate ? item.expectedCloseDate.getTime() : null
    default:
      return null
  }
}
