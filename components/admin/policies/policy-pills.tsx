// Small, non-interactive display chips for policy status,
// revision number, and category. Colors match the taxonomy in the
// Prisma enum + seed.

import { cn } from '@/lib/utils'

import type { PolicyStatusValue } from '@/lib/validations/policy'

const STATUS_STYLES: Record<PolicyStatusValue, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  PUBLISHED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  ARCHIVED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
}

const STATUS_LABELS: Record<PolicyStatusValue, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
}

export function PolicyStatusPill({
  status,
  className,
}: {
  status: PolicyStatusValue
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
        STATUS_STYLES[status],
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

/** "Rev I", "Rev II", "Rev III" ... — Makh-style roman numeral
 *  badge. Zero maps to "Draft" (no revision cut yet). Cap at 20 so
 *  a runaway counter doesn't produce a hilarious IIIIIIIIIIIIII. */
const ROMAN = [
  '', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX',
  'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX',
]

function revisionLabel(n: number): string {
  if (n <= 0) return 'Draft'
  if (n < ROMAN.length) return `Rev ${ROMAN[n]}`
  return `Rev ${n}`
}

export function RevisionBadge({
  revision,
  className,
}: {
  revision: number
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground',
        className,
      )}
    >
      {revisionLabel(revision)}
    </span>
  )
}

export function CategoryChip({
  name,
  color,
  className,
}: {
  name: string
  color: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground',
        className,
      )}
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
