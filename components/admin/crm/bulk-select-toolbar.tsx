'use client'

// Floating toolbar that appears when one or more deals are selected.
// Exposes bulk operations that map 1:1 to CrmBulkAction operations:
// Move to stage, Assign, Delete. Every action is dispatched
// via a small popover so the toolbar itself stays compact.

import { ArrowRight, MoveRight, Trash2, User as UserIcon, X } from 'lucide-react'

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

import type { PipelineStage } from '@/lib/services/crm-pipeline-service'
import type { CrmTeamMember } from '@/app/(admin)/admin/crm/opportunities/actions'

interface BulkSelectToolbarProps {
  selectedCount: number
  stages: PipelineStage[]
  members: CrmTeamMember[]
  onClear: () => void
  onMoveToStage: (stageId: string) => void
  onAssignCloser: (closerId: string | null) => void
  onDelete: () => void
  disabled?: boolean
}

export function BulkSelectToolbar({
  selectedCount,
  stages,
  members,
  onClear,
  onMoveToStage,
  onAssignCloser,
  onDelete,
  disabled = false,
}: BulkSelectToolbarProps) {
  if (selectedCount === 0) return null

  return (
    <div
      role="region"
      aria-label={`${selectedCount} selected`}
      className="pointer-events-auto fixed inset-x-0 bottom-6 z-40 mx-auto flex w-fit items-center gap-2 rounded-full border bg-background/95 px-3 py-2 shadow-lg backdrop-blur-sm"
    >
      <span className="pl-2 text-sm font-medium">
        {selectedCount} {selectedCount === 1 ? 'deal' : 'deals'} selected
      </span>
      <div className="h-4 w-px bg-border" aria-hidden />

      {/* Move to stage */}
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Move selected deals to a stage"
          render={<Button variant="ghost" size="sm" disabled={disabled} />}
        >
          <MoveRight className="size-4" />
          Move to
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-56">
          <DropdownMenuLabel>Move to stage</DropdownMenuLabel>
          {stages.map((s) => (
            <DropdownMenuItem key={s.id} onClick={() => onMoveToStage(s.id)}>
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="flex-1">{s.name}</span>
              <ArrowRight className="size-3 opacity-50" />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Assign to a setter / closer / anyone else on the team */}
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Assign selected deals to a team member"
          render={<Button variant="ghost" size="sm" disabled={disabled} />}
        >
          <UserIcon className="size-4" />
          Assign
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="max-h-72 w-56 overflow-y-auto">
          <DropdownMenuLabel>Assign to</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onAssignCloser(null)}>
            <span className="text-muted-foreground">— Unassign —</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {members.map((m) => (
            <DropdownMenuItem key={m.id} onClick={() => onAssignCloser(m.id)}>
              <span className="truncate">{m.name ?? m.email}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="h-4 w-px bg-border" aria-hidden />

      <Button
        variant="ghost"
        size="sm"
        onClick={onDelete}
        disabled={disabled}
        className={cn('text-destructive hover:text-destructive')}
      >
        <Trash2 className="size-4" />
        Delete
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={onClear}
        disabled={disabled}
        aria-label="Clear selection"
        className="size-8 rounded-full"
      >
        <X className="size-4" />
      </Button>
    </div>
  )
}
