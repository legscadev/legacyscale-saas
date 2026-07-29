'use client'

// Chip strip that renders whatever filter facets are currently
// applied. Each chip has an X to clear just that facet; the strip
// itself has a "Clear all" pill on the right. Lives above the board
// (Kanban or list) so users always see what's narrowing their view.

import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type { PipelineStage } from '@/lib/services/crm-pipeline-service'
import type { CrmTeamMember } from '@/app/(admin)/admin/crm/opportunities/actions'

import {
  countActiveFilters,
  EMPTY_FILTER,
  type OpportunityFilterState,
} from './opportunities-filter-drawer'

interface FilterChipsProps {
  filter: OpportunityFilterState
  stages: PipelineStage[]
  members: CrmTeamMember[]
  onChange: (next: OpportunityFilterState) => void
}

export function OpportunitiesFilterChips({
  filter,
  stages,
  members,
  onChange,
}: FilterChipsProps) {
  if (countActiveFilters(filter) === 0) return null

  const stageById = new Map(stages.map((s) => [s.id, s]))
  const memberById = new Map(members.map((m) => [m.id, m]))

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-dashed bg-muted/20 px-3 py-2 text-xs">
      <span className="mr-1 font-medium text-muted-foreground">
        Filtering:
      </span>

      {filter.stageIds.map((id) => {
        const s = stageById.get(id)
        return (
          <Chip
            key={`stage-${id}`}
            label={`Stage: ${s?.name ?? id}`}
            color={s?.color}
            onClear={() =>
              onChange({
                ...filter,
                stageIds: filter.stageIds.filter((x) => x !== id),
              })
            }
          />
        )
      })}

      {filter.statuses.map((st) => (
        <Chip
          key={`status-${st}`}
          label={`Status: ${st.charAt(0) + st.slice(1).toLowerCase()}`}
          onClear={() =>
            onChange({
              ...filter,
              statuses: filter.statuses.filter((x) => x !== st),
            })
          }
        />
      ))}

      {filter.assigneeIds.map((id) => {
        const m = memberById.get(id)
        return (
          <Chip
            key={`ass-${id}`}
            label={`Closer: ${m?.name ?? m?.email ?? id}`}
            onClear={() =>
              onChange({
                ...filter,
                assigneeIds: filter.assigneeIds.filter((x) => x !== id),
              })
            }
          />
        )
      })}

      {(filter.valueMin || filter.valueMax) && (
        <Chip
          label={`Value: ${filter.valueMin || '0'}${filter.valueMax ? `–${filter.valueMax}` : '+'}`}
          onClear={() =>
            onChange({ ...filter, valueMin: '', valueMax: '' })
          }
        />
      )}

      {(filter.closeDateFrom || filter.closeDateTo) && (
        <Chip
          label={`Close: ${filter.closeDateFrom || '…'} → ${filter.closeDateTo || '…'}`}
          onClear={() =>
            onChange({ ...filter, closeDateFrom: '', closeDateTo: '' })
          }
        />
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange(EMPTY_FILTER)}
        className="ml-auto h-6 px-2 text-xs"
      >
        Clear all
      </Button>
    </div>
  )
}

function Chip({
  label,
  color,
  onClear,
}: {
  label: string
  color?: string
  onClear: () => void
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 font-medium text-foreground',
      )}
    >
      {color ? (
        <span
          aria-hidden
          className="size-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      ) : null}
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Remove ${label}`}
        className="ml-0.5 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="size-3" />
      </button>
    </span>
  )
}
