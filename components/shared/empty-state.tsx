import { type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

type EmptyTone = 'brand' | 'success' | 'warning' | 'info' | 'violet' | 'neutral'

const TONE_CIRCLE: Record<EmptyTone, string> = {
  brand:
    'bg-gradient-to-br from-brand-100 to-brand-50 text-brand-600 ring-brand-200/50',
  success:
    'bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600 ring-emerald-200/50',
  warning:
    'bg-gradient-to-br from-amber-100 to-amber-50 text-amber-600 ring-amber-200/50',
  info: 'bg-gradient-to-br from-sky-100 to-sky-50 text-sky-600 ring-sky-200/50',
  violet:
    'bg-gradient-to-br from-violet-100 to-violet-50 text-violet-600 ring-violet-200/50',
  neutral: 'bg-muted text-muted-foreground ring-border/50',
}

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  /** Color of the icon circle. Defaults to brand. */
  tone?: EmptyTone
  children?: React.ReactNode
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  tone = 'brand',
  children,
}: EmptyStateProps) {
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed bg-card/60 p-12 text-center">
      {/* Soft ambient glow behind the icon. */}
      <div
        aria-hidden
        className={cn(
          'absolute left-1/2 top-12 size-48 -translate-x-1/2 rounded-full blur-3xl opacity-40 motion-safe:animate-breathe',
          tone === 'neutral'
            ? 'bg-muted'
            : tone === 'brand'
              ? 'bg-brand-200/40'
              : tone === 'success'
                ? 'bg-emerald-200/40'
                : tone === 'warning'
                  ? 'bg-amber-200/40'
                  : tone === 'info'
                    ? 'bg-sky-200/40'
                    : 'bg-violet-200/40',
        )}
      />

      <div
        className={cn(
          'relative flex size-16 items-center justify-center rounded-2xl ring-4',
          TONE_CIRCLE[tone],
        )}
      >
        <Icon className="size-7" />
      </div>
      <h3 className="relative mt-5 text-lg font-semibold tracking-tight">
        {title}
      </h3>
      {description && (
        <p className="relative mt-1.5 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {children && <div className="relative mt-5">{children}</div>}
    </div>
  )
}
