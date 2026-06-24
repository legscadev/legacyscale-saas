import { cn } from '@/lib/utils'

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'neutral'

const TONE_CLASS: Record<Tone, string> = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-error/10 text-error',
  info: 'bg-primary/10 text-primary',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  neutral: 'bg-muted text-muted-foreground',
}

const DOT_CLASS: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-error',
  info: 'bg-primary',
  violet: 'bg-violet-500',
  neutral: 'bg-muted-foreground',
}

const STATUS_MAP: Record<string, { label: string; tone: Tone }> = {
  // Course / Announcement
  PUBLISHED: { label: 'Published', tone: 'success' },
  DRAFT: { label: 'Draft', tone: 'neutral' },
  SCHEDULED: { label: 'Scheduled', tone: 'info' },
  ARCHIVED: { label: 'Archived', tone: 'warning' },
  // Lesson
  READY: { label: 'Ready', tone: 'success' },
  PROCESSING: { label: 'Processing', tone: 'warning' },
  // Enrollment
  ACTIVE: { label: 'Active', tone: 'success' },
  COMPLETED: { label: 'Completed', tone: 'info' },
  PENDING: { label: 'Pending', tone: 'warning' },
  EXPIRED: { label: 'Expired', tone: 'neutral' },
  REVOKED: { label: 'Revoked', tone: 'danger' },
  // User
  ADMIN: { label: 'Admin', tone: 'info' },
  TEAM: { label: 'Team', tone: 'violet' },
  MEMBER: { label: 'Member', tone: 'neutral' },
  PAUSED: { label: 'Paused', tone: 'danger' },
}

interface StatusBadgeProps {
  status: string
  /** Override the auto-detected label. */
  label?: string
  withDot?: boolean
  className?: string
}

export function StatusBadge({
  status,
  label,
  withDot = true,
  className,
}: StatusBadgeProps) {
  const config = STATUS_MAP[status] ?? { label: status, tone: 'neutral' as Tone }
  const tone = config.tone

  return (
    <span
      className={cn(
        'inline-flex h-5 w-fit items-center gap-1.5 rounded-full px-2 text-xs font-medium',
        TONE_CLASS[tone],
        className,
      )}
    >
      {withDot ? (
        <span className={cn('size-1.5 rounded-full', DOT_CLASS[tone])} />
      ) : null}
      {label ?? config.label}
    </span>
  )
}
