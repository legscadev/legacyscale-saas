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
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { MemberCourseDetail } from '@/lib/services/member-course-service'

type Chapter = MemberCourseDetail['chapters'][number]
type Lesson = Chapter['lessons'][number]

interface CurriculumOutlineProps {
  chapters: MemberCourseDetail['chapters']
  courseId: string
  activeLessonId?: string
  variant?: 'page' | 'sidebar'
  /**
   * Lesson ids the user is allowed to open. If omitted, gating is
   * not enforced (used by surfaces that haven't migrated yet).
   * Status-locked lessons (PROCESSING / DRAFT) stay locked
   * regardless.
   */
  unlockedIds?: Set<string>
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

function chapterProgress(chapter: Chapter): {
  completed: number
  total: number
  percent: number
} {
  const total = chapter.lessons.length
  const completed = chapter.lessons.filter(
    (l) => l.progress?.completed,
  ).length
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0
  return { completed, total, percent }
}

export function CurriculumOutline({
  chapters,
  courseId,
  activeLessonId,
  variant = 'page',
  unlockedIds,
}: CurriculumOutlineProps) {
  if (variant === 'sidebar') {
    return (
      <SidebarOutline
        chapters={chapters}
        courseId={courseId}
        activeLessonId={activeLessonId}
        unlockedIds={unlockedIds}
      />
    )
  }
  return (
    <PageOutline
      chapters={chapters}
      courseId={courseId}
      unlockedIds={unlockedIds}
    />
  )
}

// ============================================
// PAGE — chapters render as full cards with per-chapter progress
// ============================================

function PageOutline({
  chapters,
  courseId,
  unlockedIds,
}: {
  chapters: Chapter[]
  courseId: string
  unlockedIds?: Set<string>
}) {
  return (
    <div className="flex flex-col gap-4">
      {chapters.map((chapter, ci) => {
        const { completed, total, percent } = chapterProgress(chapter)
        const chapterDone = total > 0 && completed === total
        return (
          <Card key={chapter.id} className="gap-0 overflow-hidden p-0">
            <div className="space-y-2.5 border-b bg-muted/30 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={cn(
                      'inline-flex size-7 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-semibold tabular-nums',
                      chapterDone
                        ? 'bg-success/15 text-success'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {String(ci + 1).padStart(2, '0')}
                  </span>
                  <h3 className="min-w-0 truncate text-sm font-semibold">
                    {chapter.title}
                  </h3>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {completed} / {total}{' '}
                  {total === 1 ? 'lesson' : 'lessons'}
                </span>
              </div>
              {total > 0 ? (
                <Progress value={percent} className="h-1" />
              ) : null}
            </div>
            {total === 0 ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">
                No lessons yet.
              </p>
            ) : (
              <ul className="divide-y">
                {chapter.lessons.map((lesson) => (
                  <PageLessonRow
                    key={lesson.id}
                    lesson={lesson}
                    courseId={courseId}
                    gated={
                      unlockedIds !== undefined &&
                      !unlockedIds.has(lesson.id)
                    }
                  />
                ))}
              </ul>
            )}
          </Card>
        )
      })}
    </div>
  )
}

function PageLessonRow({
  lesson,
  courseId,
  gated,
}: {
  lesson: Lesson
  courseId: string
  gated: boolean
}) {
  const { Icon, label } = lessonTypeIcon(lesson.type, lesson.status)
  const completed = lesson.progress?.completed ?? false
  const statusLocked = lesson.status !== 'READY'
  const locked = statusLocked || gated
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
          {statusLocked && lesson.status === 'PROCESSING'
            ? ' · still processing'
            : null}
          {gated && !statusLocked
            ? ' · complete previous lesson first'
            : null}
        </p>
      </div>
    </>
  )

  if (locked) {
    return (
      <li
        className="flex cursor-not-allowed items-center gap-3 px-5 py-3 text-sm opacity-70"
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
        className="flex items-center gap-3 px-5 py-3 text-sm transition-colors hover:bg-muted/60"
      >
        {body}
      </Link>
    </li>
  )
}

// ============================================
// SIDEBAR — compact list used inside the player Card
// ============================================

function SidebarOutline({
  chapters,
  courseId,
  activeLessonId,
  unlockedIds,
}: {
  chapters: Chapter[]
  courseId: string
  activeLessonId?: string
  unlockedIds?: Set<string>
}) {
  return (
    <div className="flex flex-col gap-4">
      {chapters.map((chapter, ci) => {
        const { completed, total, percent } = chapterProgress(chapter)
        return (
          <div key={chapter.id}>
            <div className="mb-2 space-y-1 px-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="min-w-0 truncate text-sm font-medium">
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {String(ci + 1).padStart(2, '0')}
                  </span>{' '}
                  {chapter.title}
                </h3>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {completed} / {total}
                </span>
              </div>
              {total > 0 ? (
                <Progress value={percent} className="h-1" />
              ) : null}
            </div>
            {total === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                No lessons yet.
              </p>
            ) : (
              <ul className="flex flex-col">
                {chapter.lessons.map((lesson) => (
                  <SidebarLessonRow
                    key={lesson.id}
                    lesson={lesson}
                    courseId={courseId}
                    active={lesson.id === activeLessonId}
                    gated={
                      unlockedIds !== undefined &&
                      !unlockedIds.has(lesson.id)
                    }
                  />
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SidebarLessonRow({
  lesson,
  courseId,
  active,
  gated,
}: {
  lesson: Lesson
  courseId: string
  active: boolean
  gated: boolean
}) {
  const { Icon, label } = lessonTypeIcon(lesson.type, lesson.status)
  const completed = lesson.progress?.completed ?? false
  const statusLocked = lesson.status !== 'READY'
  const locked = statusLocked || gated
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
          {statusLocked && lesson.status === 'PROCESSING'
            ? ' · still processing'
            : null}
          {gated && !statusLocked
            ? ' · complete previous lesson first'
            : null}
        </p>
      </div>
    </>
  )

  const baseClass = cn(
    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
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
        scroll={false}
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
