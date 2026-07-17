// Small display primitives used across the tracker's list, kanban,
// and detail views. Kept as tiny presentational components so they
// stay portable and don't leak layout assumptions.

import type { TaskPriority } from '@prisma/client'

import { cn } from '@/lib/utils'

// ============================================
// STATUS
// ============================================

interface StatusPillProps {
  name: string
  color: string
  className?: string
}

/** Rounded pill with the tenant-configured status color as a soft
 *  background + solid dot. Uses the raw hex — no palette mapping —
 *  so admin-picked colors show up as chosen. */
export function StatusPill({ name, color, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5',
        'text-[11px] font-medium leading-none whitespace-nowrap',
        className,
      )}
      style={{
        backgroundColor: `${color}14`, // ~8% alpha
        borderColor: `${color}66`,
        color,
      }}
    >
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {name}
    </span>
  )
}

// ============================================
// PRIORITY
// ============================================

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  CRITICAL:
    'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',
  HIGH: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
  MEDIUM:
    'bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/60',
  LOW: 'bg-muted text-muted-foreground border-border',
}

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
}

interface PriorityPillProps {
  priority: TaskPriority
  className?: string
}

export function PriorityPill({ priority, className }: PriorityPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5',
        'text-[11px] font-medium leading-none whitespace-nowrap',
        PRIORITY_STYLE[priority],
        className,
      )}
    >
      {PRIORITY_LABEL[priority]}
    </span>
  )
}

// ============================================
// LABELS
// ============================================

interface LabelChipProps {
  name: string
  color: string
  className?: string
}

/** Compact tag chip. Multiple usually render inline-flex-wrap. */
export function LabelChip({ name, color, className }: LabelChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5',
        'text-[10px] font-medium leading-none whitespace-nowrap',
        className,
      )}
      style={{
        backgroundColor: `${color}14`,
        borderColor: `${color}66`,
        color,
      }}
    >
      {name}
    </span>
  )
}
