'use client'

// Floating toolbar that appears when one or more deals are selected.
// Shipped now as UI-only so Phase 3 can wire real bulk actions
// (delete, move-to-stage, assign) without churning the board or
// list view again.

import { Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface BulkSelectToolbarProps {
  selectedCount: number
  onClear: () => void
  onDelete: () => void
  disabled?: boolean
}

export function BulkSelectToolbar({
  selectedCount,
  onClear,
  onDelete,
  disabled = false,
}: BulkSelectToolbarProps) {
  if (selectedCount === 0) return null

  return (
    <div
      role="region"
      aria-label={`${selectedCount} selected`}
      className="pointer-events-auto fixed inset-x-0 bottom-6 z-40 mx-auto flex w-fit items-center gap-3 rounded-full border bg-background/95 px-4 py-2 shadow-lg backdrop-blur-sm"
    >
      <span className="text-sm font-medium">
        {selectedCount} {selectedCount === 1 ? 'deal' : 'deals'} selected
      </span>
      <div className="h-4 w-px bg-border" aria-hidden />
      <Button
        variant="ghost"
        size="sm"
        onClick={onDelete}
        disabled={disabled}
        className="text-destructive hover:text-destructive"
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
