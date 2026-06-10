import Link from 'next/link'
import {
  CheckCircle2,
  Circle,
  FileText,
  GraduationCap,
  Loader2,
  Lock,
  PlayCircle,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import type { MemberCourseDetail } from '@/lib/services/member-course-service'

interface CurriculumOutlineProps {
  chapters: MemberCourseDetail['chapters']
  courseId: string
  activeLessonId?: string
  variant?: 'page' | 'sidebar'
}

function lessonTypeIcon(
  type: 'VIDEO' | 'QUIZ' | 'RESOURCE',
  status: 'DRAFT' | 'PROCESSING' | 'READY',
): { Icon: LucideIcon; label: string } {
  if (status === 'PROCESSING') return { Icon: Loader2, label: 'Processing' }
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

export function CurriculumOutline({
  chapters,
  courseId,
  activeLessonId,
  variant = 'page',
}: CurriculumOutlineProps) {
  const sidebar = variant === 'sidebar'

  return (
    <div className={cn('flex flex-col', sidebar ? 'gap-4' : 'gap-6')}>
      {chapters.map((chapter, ci) => (
        <div key={chapter.id}>
          <div className="mb-2 flex items-center justify-between px-1">
            <h3 className="text-sm font-medium">
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {String(ci + 1).padStart(2, '0')}
              </span>{' '}
              {chapter.title}
            </h3>
            <span className="text-xs text-muted-foreground">
              {chapter.lessons.length}{' '}
              {chapter.lessons.length === 1 ? 'lesson' : 'lessons'}
            </span>
          </div>
          {chapter.lessons.length === 0 ? (
            <p
              className={cn(
                'text-sm text-muted-foreground',
                sidebar ? 'px-3 py-2' : 'rounded-xl border px-4 py-3',
              )}
            >
              No lessons yet.
            </p>
          ) : (
            <ul className={cn(!sidebar && 'overflow-hidden rounded-xl border')}>
              {chapter.lessons.map((lesson, li) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  courseId={courseId}
                  active={lesson.id === activeLessonId}
                  sidebar={sidebar}
                  withTopBorder={!sidebar && li > 0}
                />
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

interface LessonRowProps {
  lesson: MemberCourseDetail['chapters'][number]['lessons'][number]
  courseId: string
  active: boolean
  sidebar: boolean
  withTopBorder: boolean
}

function LessonRow({
  lesson,
  courseId,
  active,
  sidebar,
  withTopBorder,
}: LessonRowProps) {
  const { Icon, label } = lessonTypeIcon(lesson.type, lesson.status)
  const completed = lesson.progress?.completed ?? false
  const locked = lesson.status !== 'READY'
  const duration = formatDuration(lesson.durationSeconds)

  const body = (
    <>
      {completed ? (
        <CheckCircle2 className="size-4 shrink-0 text-success" />
      ) : locked ? (
        <Lock className="size-4 shrink-0 text-muted-foreground/60" />
      ) : (
        <Circle className="size-4 shrink-0 text-muted-foreground/50" />
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-sm',
            active && 'font-medium text-primary',
            locked && !completed && 'text-muted-foreground',
          )}
        >
          {lesson.title}
        </p>
        <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          <Icon
            className={cn(
              'size-3',
              lesson.status === 'PROCESSING' && 'animate-spin',
            )}
          />
          {label}
          {duration ? ` · ${duration}` : ''}
          {locked && lesson.status === 'PROCESSING'
            ? ' · still processing'
            : null}
        </p>
      </div>
    </>
  )

  const baseClass = cn(
    'flex items-center gap-3 px-3 py-2.5 text-sm transition-colors',
    withTopBorder && 'border-t',
    sidebar && 'rounded-lg',
  )

  if (locked) {
    return (
      <li
        className={cn(baseClass, 'cursor-not-allowed opacity-70')}
        aria-disabled
      >
        {body}
      </li>
    )
  }

  return (
    <li>
      <Link
        href={`/courses/${courseId}/lessons/${lesson.id}`}
        scroll={!sidebar}
        aria-current={active ? 'page' : undefined}
        className={cn(
          baseClass,
          active ? 'bg-primary/10' : 'hover:bg-muted/60',
        )}
      >
        {body}
      </Link>
    </li>
  )
}
