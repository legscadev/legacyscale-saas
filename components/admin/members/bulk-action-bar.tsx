'use client'

import { useEffect } from 'react'
import { Archive, Download, ShieldCheck, UserX, X } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface BulkActionBarProps {
  selectedCount: number
  onClear: () => void
}

export function BulkActionBar({ selectedCount, onClear }: BulkActionBarProps) {
  // Esc deselects everything.
  useEffect(() => {
    if (selectedCount === 0) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClear()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedCount, onClear])

  if (selectedCount === 0) return null

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4"
    >
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border bg-popover px-2 py-1.5 shadow-lg ring-1 ring-foreground/10 animate-in fade-in slide-in-from-bottom-2 duration-200">
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium tabular-nums text-primary">
          {selectedCount} selected
        </span>
        <span className="mx-0.5 h-5 w-px bg-border" />
        <Button variant="ghost" size="sm" disabled>
          <ShieldCheck className="size-4" />
          Assign role
        </Button>
        <Button variant="ghost" size="sm" disabled>
          <UserX className="size-4" />
          Change status
        </Button>
        <Button variant="ghost" size="sm" disabled>
          <Archive className="size-4" />
          Archive
        </Button>
        <Button variant="ghost" size="sm" disabled>
          <Download className="size-4" />
          Export
        </Button>
        <span className="mx-0.5 h-5 w-px bg-border" />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClear}
          aria-label="Clear selection"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  )
}
