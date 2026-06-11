import Link from 'next/link'
import {
  ChevronRight,
  FileText,
  GraduationCap,
  PlayCircle,
  type LucideIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface UpNextCardProps {
  chapterTitle: string
  lesson: {
    title: string
    type: 'VIDEO' | 'QUIZ' | 'RESOURCE'
    durationSeconds: number | null
  }
  href: string
  ctaLabel?: string
}

function typeIcon(type: UpNextCardProps['lesson']['type']): {
  Icon: LucideIcon
  label: string
} {
  if (type === 'VIDEO') return { Icon: PlayCircle, label: 'Video' }
  if (type === 'QUIZ') return { Icon: GraduationCap, label: 'Quiz' }
  return { Icon: FileText, label: 'Resource' }
}

function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function UpNextCard({
  chapterTitle,
  lesson,
  href,
  ctaLabel = 'Resume',
}: UpNextCardProps) {
  const { Icon, label } = typeIcon(lesson.type)
  const duration = formatDuration(lesson.durationSeconds)

  return (
    <Card variant="raised" className="gap-3 p-5">
      <div className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Up next
        </p>
        <p className="truncate text-xs text-muted-foreground">{chapterTitle}</p>
        <p className="line-clamp-2 text-sm font-semibold leading-snug">
          {lesson.title}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="size-3.5" />
          {label}
          {duration ? ` · ${duration}` : ''}
        </p>
      </div>
      <Button
        size="sm"
        className="w-full"
        render={<Link href={href} />}
      >
        {ctaLabel}
        <ChevronRight />
      </Button>
    </Card>
  )
}
