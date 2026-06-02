import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'

interface MembersPaginationProps {
  page: number
  totalPages: number
  total: number
  limit: number
}

export function MembersPagination({
  page,
  totalPages,
  total,
  limit,
}: MembersPaginationProps) {
  if (totalPages <= 1) return null

  const from = (page - 1) * limit + 1
  const to = Math.min(page * limit, total)

  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <p>
        Showing <span className="font-medium text-foreground">{from}</span>–
        <span className="font-medium text-foreground">{to}</span> of{' '}
        <span className="font-medium text-foreground">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <PageLink page={page - 1} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </PageLink>
        <span className="px-2 tabular-nums">
          Page {page} of {totalPages}
        </span>
        <PageLink
          page={page + 1}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </PageLink>
      </div>
    </div>
  )
}

function PageLink({
  page,
  disabled,
  children,
  ...rest
}: {
  page: number
  disabled?: boolean
  children: React.ReactNode
  'aria-label'?: string
}) {
  const className = cn(
    'grid size-8 place-items-center rounded-md border transition-colors',
    disabled
      ? 'cursor-not-allowed border-border/50 text-muted-foreground/50'
      : 'border-border hover:bg-muted hover:text-foreground'
  )

  if (disabled) {
    return (
      <span className={className} {...rest}>
        {children}
      </span>
    )
  }

  return (
    <Link href={`/admin/members?page=${page}`} className={className} {...rest}>
      {children}
    </Link>
  )
}
