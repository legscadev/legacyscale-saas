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
}: CurriculumOutlineProps) {
  return (
    <ol className="space-y-3">
      {chapters.map((chapter, i) => (
        <li key={chapter.id} className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Chapter {String(i + 1).padStart(2, '0')}
              </p>
              <p className="text-sm font-semibold">{chapter.title}</p>
            </div>
            <span className="text-xs text-muted-foreground">
              {chapter.lessons.length}{' '}
              {chapter.lessons.length === 1 ? 'lesson' : 'lessons'}
            </span>
          </div>
          {chapter.lessons.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              No lessons yet.
            </p>
          ) : (
            <ul className="divide-y">
              {chapter.lessons.map((lesson) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  courseId={courseId}
                  active={lesson.id === activeLessonId}
                />
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  )
}

interface LessonRowProps {
  lesson: MemberCourseDetail['chapters'][number]['lessons'][number]
  courseId: string
  active: boolean
}

function LessonRow({ lesson, courseId, active }: LessonRowProps) {
  const { Icon, label } = lessonTypeIcon(lesson.type, lesson.status)
  const completed = lesson.progress?.completed ?? false
  const locked = lesson.status !== 'READY'
  const duration = formatDuration(lesson.durationSeconds)

  const body = (
    <>
      {completed ? (
        <CheckCircle2 className="size-5 shrink-0 text-success" />
      ) : locked ? (
        <Lock className="size-5 shrink-0 text-muted-foreground/60" />
      ) : (
        <Circle className="size-5 shrink-0 text-muted-foreground/50" />
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

  if (locked) {
    return (
      <li
        className="flex cursor-not-allowed items-center gap-3 px-4 py-3 opacity-70"
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
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center gap-3 px-4 py-3 transition-colors',
          active ? 'bg-primary/10' : 'hover:bg-muted/60',
        )}
      >
        {body}
      </Link>
    </li>
  )
}
