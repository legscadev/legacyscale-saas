import { type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'

export interface StatStripCell {
  label: string
  value: string | number
  description?: string
  /** Optional small icon next to the label. */
  icon?: LucideIcon
  /** Subtle text tint on the value (e.g. "success"/"warning"/"destructive"
   *  via Tailwind class). Default: foreground. */
  valueClassName?: string
}

interface StatStripProps {
  cells: StatStripCell[]
  className?: string
}

/**
 * Horizontal text-stat strip. Designed for reporting surfaces where
 * the page already has a primary table — we want compact, scannable
 * numbers above it without the visual weight of the premium StatCard.
 * Cells are divided by a hairline rule; on small screens they wrap
 * into a grid.
 */
export function StatStrip({ cells, className }: StatStripProps) {
  return (
    <Card
      className={cn(
        'grid grid-cols-2 gap-0 divide-x divide-y divide-border p-0 sm:grid-cols-4 sm:divide-y-0',
        className,
      )}
    >
      {cells.map((cell) => (
        <div
          key={cell.label}
          className="flex flex-col gap-1 px-4 py-3"
        >
          <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {cell.icon ? (
              <cell.icon className="size-3 text-muted-foreground/70" />
            ) : null}
            {cell.label}
          </p>
          <p
            className={cn(
              'text-2xl font-semibold tabular-nums',
              cell.valueClassName,
            )}
          >
            {cell.value}
          </p>
          {cell.description ? (
            <p className="truncate text-[11px] text-muted-foreground">
              {cell.description}
            </p>
          ) : null}
        </div>
      ))}
    </Card>
  )
}
