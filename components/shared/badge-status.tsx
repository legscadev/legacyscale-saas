import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Status = 'success' | 'warning' | 'error' | 'info' | 'default'

interface BadgeStatusProps {
  status: Status
  children: React.ReactNode
  className?: string
}

const statusStyles: Record<Status, string> = {
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  error: 'bg-destructive/10 text-destructive border-destructive/20',
  info: 'bg-primary/10 text-primary border-primary/20',
  default: 'bg-muted text-muted-foreground border-border',
}

export function BadgeStatus({ status, children, className }: BadgeStatusProps) {
  return (
    <Badge variant="outline" className={cn(statusStyles[status], className)}>
      {children}
    </Badge>
  )
}

export function BadgePublished({ className }: { className?: string }) {
  return (
    <BadgeStatus status="success" className={className}>
      Published
    </BadgeStatus>
  )
}

export function BadgeDraft({ className }: { className?: string }) {
  return (
    <BadgeStatus status="default" className={className}>
      Draft
    </BadgeStatus>
  )
}

export function BadgeScheduled({ className }: { className?: string }) {
  return (
    <BadgeStatus status="info" className={className}>
      Scheduled
    </BadgeStatus>
  )
}

export function BadgeArchived({ className }: { className?: string }) {
  return (
    <BadgeStatus status="warning" className={className}>
      Archived
    </BadgeStatus>
  )
}

export function BadgeProcessing({ className }: { className?: string }) {
  return (
    <BadgeStatus status="info" className={className}>
      Processing
    </BadgeStatus>
  )
}

export function BadgeActive({ className }: { className?: string }) {
  return (
    <BadgeStatus status="success" className={className}>
      Active
    </BadgeStatus>
  )
}

export function BadgeInactive({ className }: { className?: string }) {
  return (
    <BadgeStatus status="error" className={className}>
      Inactive
    </BadgeStatus>
  )
}
