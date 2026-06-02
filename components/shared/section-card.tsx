import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface SectionCardProps {
  title?: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  contentClassName?: string
  /** Remove content padding (e.g. for full-bleed tables). */
  flush?: boolean
}

/** Card with a standard header row (title/description + action). */
export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
  flush,
}: SectionCardProps) {
  return (
    <Card className={cn('gap-0', className)}>
      {title || action ? (
        <CardHeader className="flex flex-row items-center justify-between gap-2 border-b pb-3">
          <div className="space-y-0.5">
            {title ? (
              <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            ) : null}
            {description ? (
              <p className="text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </CardHeader>
      ) : null}
      <CardContent className={cn(flush ? 'p-0' : 'pt-4', contentClassName)}>
        {children}
      </CardContent>
    </Card>
  )
}
