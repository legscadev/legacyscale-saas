import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  /** Right-aligned actions (buttons, filters). */
  actions?: React.ReactNode
  /** Optional eyebrow / breadcrumb element above the title. */
  eyebrow?: React.ReactNode
  /** Same as `actions` — kept for backwards compatibility. */
  children?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  children,
  className,
}: PageHeaderProps) {
  const rightSide = actions ?? children

  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {rightSide ? (
        <div className="flex shrink-0 items-center gap-2">{rightSide}</div>
      ) : null}
    </div>
  )
}
