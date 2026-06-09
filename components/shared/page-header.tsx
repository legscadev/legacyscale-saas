import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface PageHeaderProps {
  title: string
  description?: string
  /** Right-aligned actions (buttons, filters). */
  actions?: React.ReactNode
  /** Optional eyebrow content above the title (label / chip). */
  eyebrow?: React.ReactNode
  /** Breadcrumb trail rendered above the title. Last item is the current page. */
  breadcrumbs?: BreadcrumbItem[]
  /** Same as `actions` — kept for backwards compatibility. */
  children?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  breadcrumbs,
  children,
  className,
}: PageHeaderProps) {
  const rightSide = actions ?? children
  const hasBreadcrumbs = breadcrumbs && breadcrumbs.length > 0

  return (
    <div className={cn('space-y-3', className)}>
      {hasBreadcrumbs ? (
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1 text-xs text-muted-foreground"
        >
          {breadcrumbs.map((item, i) => {
            const isLast = i === breadcrumbs.length - 1
            return (
              <span key={`${item.label}-${i}`} className="flex items-center gap-1">
                {item.href && !isLast ? (
                  <Link
                    href={item.href}
                    className="rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    className={cn(
                      'px-1.5 py-0.5',
                      isLast && 'font-medium text-foreground',
                    )}
                    aria-current={isLast ? 'page' : undefined}
                  >
                    {item.label}
                  </span>
                )}
                {!isLast ? (
                  <ChevronRight aria-hidden className="size-3.5 text-muted-foreground/40" />
                ) : null}
              </span>
            )
          })}
        </nav>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          {eyebrow ? (
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {eyebrow}
            </div>
          ) : (
            <span
              aria-hidden
              className="block h-1 w-10 rounded-full bg-gradient-to-r from-primary to-primary/40"
            />
          )}
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-[2rem] sm:leading-tight">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-sm text-muted-foreground sm:text-[15px]">
              {description}
            </p>
          ) : null}
        </div>
        {rightSide ? (
          <div className="flex shrink-0 items-center gap-2 sm:pt-1">{rightSide}</div>
        ) : null}
      </div>
    </div>
  )
}
