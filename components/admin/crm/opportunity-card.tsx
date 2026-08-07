'use client'

// A single deal card on the pipeline board. Mirrors the Task
// Tracker's KanbanCard: a forwardRef block so the sortable wrapper
// only has to spread ref + listeners onto the outer div.

import { forwardRef } from 'react'
import {
  BadgeCheck,
  BadgeX,
  Building2,
  CalendarDays,
  CheckSquare,
  MessageSquare,
  StickyNote,
  Tag,
  User as UserIcon,
} from 'lucide-react'

import { AvatarGroup } from '@/components/shared/avatar-group'
import { fmtCalendarDateShort } from '@/lib/format'
import { cn } from '@/lib/utils'

import type { OpportunityListItem } from '@/lib/services/crm-opportunity-service'

const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export function formatDealValue(value: number | null): string | null {
  if (value === null) return null
  return currencyFmt.format(value)
}

interface OpportunityCardProps extends React.HTMLAttributes<HTMLDivElement> {
  opportunity: OpportunityListItem
  /** True while the card is being lifted by dnd-kit; parent applies
   *  the ghost style to the underlying slot. */
  isDragging?: boolean
  onOpen?: () => void
}

export const OpportunityCard = forwardRef<HTMLDivElement, OpportunityCardProps>(
  function OpportunityCard(
    { opportunity, isDragging, onOpen, className, ...rest },
    ref,
  ) {
    const value = formatDealValue(opportunity.value)
    const subtitle = opportunity.companyName ?? opportunity.contactName

    return (
      <div
        ref={ref}
        {...rest}
        onClick={(e) => {
          rest.onClick?.(e)
          if (!e.defaultPrevented && onOpen) onOpen()
        }}
        className={cn(
          'group/opp-card space-y-2 rounded-lg border bg-card p-3 shadow-sm',
          'cursor-grab transition-colors hover:border-primary/30 hover:bg-accent/40',
          'active:cursor-grabbing',
          isDragging && 'opacity-40',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-sm font-medium leading-snug">
            {opportunity.name}
          </p>
          {value ? (
            <span className="shrink-0 text-sm font-semibold tabular-nums text-emerald-600">
              {value}
            </span>
          ) : null}
        </div>

        {subtitle ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {opportunity.companyName ? (
              <Building2 className="size-3 shrink-0" aria-hidden />
            ) : (
              <UserIcon className="size-3 shrink-0" aria-hidden />
            )}
            <span className="truncate">{subtitle}</span>
          </p>
        ) : null}

        {opportunity.source ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Tag className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{opportunity.source}</span>
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <div className="flex min-w-0 items-center gap-2">
            {opportunity.expectedCloseDate ? (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <CalendarDays className="size-3" aria-hidden />
                {fmtCalendarDateShort(opportunity.expectedCloseDate)}
              </span>
            ) : null}
            {opportunity.probability !== null ? (
              <span className="tabular-nums">{opportunity.probability}%</span>
            ) : null}
            <ActivityChip
              icon={CheckSquare}
              count={opportunity.openTaskCount}
              label="open tasks"
            />
            <ActivityChip
              icon={MessageSquare}
              count={opportunity.noteCount}
              label="notes"
            />
            {opportunity.hasNotes ? (
              <span
                aria-label="Has description"
                title="Has description"
                className="inline-flex size-4 items-center justify-center rounded bg-muted text-muted-foreground/80"
              >
                <StickyNote className="size-3" aria-hidden />
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {opportunity.assignedCloser ? (
              <AvatarGroup
                users={[
                  {
                    name:
                      opportunity.assignedCloser.name ??
                      opportunity.assignedCloser.email,
                    avatarUrl: opportunity.assignedCloser.avatarUrl,
                  },
                ]}
                size="sm"
                max={1}
              />
            ) : null}
            {opportunity.qualified !== null ? (
              <QualifiedIcon qualified={opportunity.qualified} />
            ) : null}
          </div>
        </div>
      </div>
    )
  },
)

/** Sticky qualified/unqualified symbol shown at the card's bottom-right.
 *  Driven by the deal's durable `qualified` flag (set at application
 *  completion), so it tracks the lead across every stage. Icon-only to
 *  stay compact; the label lives in the tooltip / aria-label. */
function QualifiedIcon({ qualified }: { qualified: boolean }) {
  return (
    <span
      aria-label={qualified ? 'Qualified lead' : 'Unqualified lead'}
      title={qualified ? 'Qualified' : 'Unqualified'}
      className={cn(
        'inline-flex shrink-0 items-center justify-center',
        qualified
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-amber-500 dark:text-amber-400',
      )}
    >
      {qualified ? (
        <BadgeCheck className="size-4" aria-hidden />
      ) : (
        <BadgeX className="size-4" aria-hidden />
      )}
    </span>
  )
}

/** Icon + numeric badge shown only when count > 0 — keeps the card
 *  tidy for brand-new deals that have no activity yet. */
function ActivityChip({
  icon: Icon,
  count,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>
  count: number
  label: string
}) {
  if (count <= 0) return null
  return (
    <span
      aria-label={`${count} ${label}`}
      title={`${count} ${label}`}
      className="inline-flex items-center gap-0.5 tabular-nums"
    >
      <Icon className="size-3" aria-hidden />
      {count}
    </span>
  )
}
