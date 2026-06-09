import { cn } from '@/lib/utils'

interface FormSectionProps {
  title: string
  description?: string
  /** Optional right-aligned action (e.g. "Reset" button). */
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}

/**
 * Two-column form section: title + description on the left,
 * controls on the right. Stacks on mobile. Sections sit on top of
 * each other separated by a top border (except the first).
 */
export function FormSection({
  title,
  description,
  action,
  children,
  className,
}: FormSectionProps) {
  return (
    <section
      className={cn(
        'grid gap-6 border-t pt-8 first:border-t-0 first:pt-0 sm:grid-cols-[14rem_1fr] sm:gap-8',
        className,
      )}
    >
      <header className="space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        {description ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </header>
      <div className="space-y-6">{children}</div>
    </section>
  )
}
