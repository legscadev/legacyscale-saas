import Link from 'next/link'
import {
  Check,
  FileText,
  HelpCircle,
  Lock,
  type LucideIcon,
  Play,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type LessonType = 'VIDEO' | 'QUIZ' | 'RESOURCE'

interface LessonItemProps {
  lesson: {
    id: string
    title: string
    type: LessonType
    durationSeconds?: number | null
  }
  isCompleted?: boolean
  isLocked?: boolean
  isActive?: boolean
  href?: string
  className?: string
}

const lessonIcons: Record<LessonType, LucideIcon> = {
  VIDEO: Play,
  QUIZ: HelpCircle,
  RESOURCE: FileText,
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function LessonItem({
  lesson,
  isCompleted = false,
  isLocked = false,
  isActive = false,
  href,
  className,
}: LessonItemProps) {
  const Icon = lessonIcons[lesson.type]

  const content = (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
        isActive && 'bg-accent',
        !isLocked && !isActive && 'hover:bg-accent/50',
        isLocked && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      <div
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full border',
          isCompleted && 'border-success bg-success text-white',
          !isCompleted && !isLocked && 'border-border bg-background',
          isLocked && 'border-border bg-muted'
        )}
      >
        {isCompleted ? (
          <Check className="size-4" />
        ) : isLocked ? (
          <Lock className="size-4" />
        ) : (
          <Icon className="size-4" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-sm font-medium',
            isActive && 'text-primary'
          )}
        >
          {lesson.title}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="capitalize">{lesson.type.toLowerCase()}</span>
          {lesson.durationSeconds != null && (
            <>
              <span>•</span>
              <span>{formatDuration(lesson.durationSeconds)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )

  if (href && !isLocked) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    )
  }

  return content
}
