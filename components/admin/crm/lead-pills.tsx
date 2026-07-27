'use client'

// Small presentational pills for lead status + source. Colour comes
// from the shared maps in the validations module so the table,
// filters, and any future timeline stay in sync.

import { cn } from '@/lib/utils'
import {
  CRM_LEAD_SOURCE_LABELS,
  CRM_LEAD_STATUS_COLORS,
  CRM_LEAD_STATUS_LABELS,
  type CrmLeadSourceValue,
  type CrmLeadStatusValue,
} from '@/lib/validations/crm-lead'

export function LeadStatusPill({
  status,
  className,
}: {
  status: CrmLeadStatusValue
  className?: string
}) {
  const color = CRM_LEAD_STATUS_COLORS[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
        className,
      )}
      style={{ borderColor: `${color}66`, color, backgroundColor: `${color}14` }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {CRM_LEAD_STATUS_LABELS[status]}
    </span>
  )
}

export function LeadSourceBadge({ source }: { source: string }) {
  const label =
    CRM_LEAD_SOURCE_LABELS[source as CrmLeadSourceValue] ?? source
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      {label}
    </span>
  )
}
