import { type LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type StatTone = 'brand' | 'success' | 'warning' | 'info' | 'violet' | 'neutral'

const TONE_BADGE: Record<StatTone, string> = {
  brand:
    'bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md shadow-brand-500/30',
  success:
    'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-md shadow-emerald-500/30',
  warning:
    'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-md shadow-amber-500/30',
  info: 'bg-gradient-to-br from-sky-400 to-sky-600 text-white shadow-md shadow-sky-500/30',
  violet:
    'bg-gradient-to-br from-violet-400 to-violet-600 text-white shadow-md shadow-violet-500/30',
  neutral: 'bg-muted text-muted-foreground',
}

const TONE_ACCENT: Record<StatTone, string> = {
  brand: 'from-brand-500 to-brand-300',
  success: 'from-emerald-500 to-emerald-300',
  warning: 'from-amber-500 to-amber-300',
  info: 'from-sky-500 to-sky-300',
  violet: 'from-violet-500 to-violet-300',
  neutral: 'from-muted-foreground/40 to-muted-foreground/10',
}

const TONE_GLOW: Record<StatTone, string> = {
  brand: 'from-brand-500/5',
  success: 'from-emerald-500/5',
  warning: 'from-amber-500/5',
  info: 'from-sky-500/5',
  violet: 'from-violet-500/5',
  neutral: 'from-muted/40',
}

// Compact-variant tone treatment — flat tinted background + matching
// foreground colour, no gradient or shadow. Designed to read at small
// sizes without the heavy premium badging of the default variant.
const TONE_BADGE_SM: Record<StatTone, string> = {
  brand: 'bg-brand-500/10 text-brand-600 dark:text-brand-400',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  info: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  neutral: 'bg-muted text-muted-foreground',
}

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon?: LucideIcon
  /** Color treatment. Defaults to "neutral". */
  tone?: StatTone
  trend?: {
    value: number
    isPositive: boolean
  }
  /** "default" is the full-bleed premium card. "sm" is a compact
   *  rectangle for dense dashboards — no accent bar, no hover lift,
   *  smaller padding + typography. */
  size?: 'default' | 'sm'
  className?: string
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  tone = 'neutral',
  trend,
  size = 'default',
  className,
}: StatCardProps) {
  if (size === 'sm') {
    return (
      <Card className={cn('gap-0 p-3', className)}>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          {Icon ? (
            <span
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-md',
                TONE_BADGE_SM[tone],
              )}
            >
              <Icon className="size-3.5" />
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 text-xl font-semibold tabular-nums">{value}</p>
        {(description || trend) && (
          <div className="mt-0.5 flex items-center gap-1.5">
            {trend && (
              <span
                className={cn(
                  'text-[11px] font-semibold',
                  trend.isPositive ? 'text-success' : 'text-destructive',
                )}
              >
                {trend.isPositive ? '+' : ''}
                {trend.value}%
              </span>
            )}
            {description && (
              <span className="truncate text-[11px] text-muted-foreground">
                {description}
              </span>
            )}
          </div>
        )}
      </Card>
    )
  }

  return (
    <Card
      className={cn(
        'group relative overflow-hidden p-0 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-foreground/5',
        className,
      )}
    >
      {/* Top accent bar — bleeds the tone color into the card edge. */}
      <div
        aria-hidden
        className={cn(
          'absolute inset-x-0 top-0 h-1 bg-gradient-to-r',
          TONE_ACCENT[tone],
        )}
      />
      {/* Soft tone glow in the top-right corner for atmosphere. */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-gradient-radial blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100',
          'bg-gradient-to-br to-transparent',
          TONE_GLOW[tone],
        )}
      />

      <div className="relative space-y-3 p-5">
        <div className="flex items-start justify-between">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {Icon ? (
            <span
              className={cn(
                'flex size-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3',
                TONE_BADGE[tone],
              )}
            >
              <Icon className="size-5" />
            </span>
          ) : null}
        </div>
        <div>
          <p className="text-4xl font-bold tracking-tight tabular-nums">
            {value}
          </p>
          {(description || trend) && (
            <div className="mt-1.5 flex items-center gap-2">
              {trend && (
                <span
                  className={cn(
                    'text-xs font-semibold',
                    trend.isPositive ? 'text-success' : 'text-destructive',
                  )}
                >
                  {trend.isPositive ? '+' : ''}
                  {trend.value}%
                </span>
              )}
              {description && (
                <span className="text-xs text-muted-foreground">
                  {description}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
