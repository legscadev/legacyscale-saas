'use client'

// Sortable wrappers around MetricCard (grid view) and the metrics
// table row. Kept as thin containers so MetricCard doesn't need to
// know about @dnd-kit — the wrapper attaches the sortable ref,
// forwards the transform/opacity, and renders a small grip handle
// that shows on hover. Reorder is admin-only; when disabled the
// handle isn't rendered at all.

import { forwardRef, type CSSProperties, type ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

import { cn } from '@/lib/utils'

interface SortableItemProps {
  id: string
  disabled?: boolean
  /** Grid children — the MetricCard. */
  children: ReactNode
  /** Extra class on the outer wrapper (the grid item). */
  className?: string
  /** Small badge showing the user's current position in the grid.
   *  Rendered next to the handle so admins can see "this is #5". */
  positionLabel?: string
  /** Where to pin the grip handle. Card layouts want top-left; table
   *  rows want a leading cell. */
  handlePlacement?: 'card' | 'row'
}

export const SortableMetric = forwardRef<HTMLDivElement, SortableItemProps>(
  function SortableMetric(
    { id, disabled = false, children, className, positionLabel, handlePlacement = 'card' },
    _forwardedRef,
  ) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id, disabled })

    const style: CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      // Lift while dragging so the ghost tracks the pointer cleanly.
      zIndex: isDragging ? 20 : undefined,
      opacity: isDragging ? 0.85 : 1,
    }

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn('group/sortable relative', className)}
      >
        {children}
        {!disabled ? (
          <button
            type="button"
            aria-label={`Reorder ${positionLabel ?? 'item'}`}
            {...attributes}
            {...listeners}
            className={cn(
              'absolute inline-flex size-6 items-center justify-center rounded-md border border-input bg-background/80 text-muted-foreground shadow-sm backdrop-blur transition-opacity',
              'opacity-0 group-hover/sortable:opacity-100 focus-visible:opacity-100',
              'cursor-grab active:cursor-grabbing hover:text-foreground',
              handlePlacement === 'card'
                ? 'left-2 top-2'
                : 'left-1 top-1/2 -translate-y-1/2 border-transparent shadow-none',
            )}
            title="Drag to reorder"
          >
            <GripVertical className="size-3.5" />
          </button>
        ) : null}
      </div>
    )
  },
)
