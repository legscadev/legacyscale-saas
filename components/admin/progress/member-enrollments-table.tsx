'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  ExternalLink,
  FileText,
  GraduationCap,
  PlayCircle,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/shared'
import { getMemberCourseProgressAction } from '@/app/(admin)/admin/progress/members/[id]/actions'
import type {
  MemberCourseProgress,
  MemberEnrollmentRow,
} from '@/lib/services/admin-progress-service'

interface MemberEnrollmentsTableProps {
  userId: string
  enrollments: MemberEnrollmentRow[]
}

type DrilldownState =
  | { status: 'loading' }
  | { status: 'ready'; data: MemberCourseProgress }
  | { status: 'empty' }
  | { status: 'error'; message: string }

function fmtDate(date: Date | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function relativeTime(date: Date | null): string {
  if (!date) return 'Never'
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.round(diffMs / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  if (diffDay < 30) return `${diffDay}d ago`
  const diffMonth = Math.round(diffDay / 30)
  if (diffMonth < 12) return `${diffMonth}mo ago`
  return `${Math.round(diffMonth / 12)}y ago`
}

export function MemberEnrollmentsTable({
  userId,
  enrollments,
}: MemberEnrollmentsTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [drilldowns, setDrilldowns] = useState<
    Record<string, DrilldownState | undefined>
  >({})

  const toggle = useCallback(
    async (courseId: string) => {
      if (expanded === courseId) {
        setExpanded(null)
        return
      }
      setExpanded(courseId)
      // Only fetch once per course — re-expanding reuses cached state.
      if (drilldowns[courseId]) return
      setDrilldowns((prev) => ({ ...prev, [courseId]: { status: 'loading' } }))
      try {
        const data = await getMemberCourseProgressAction(userId, courseId)
        setDrilldowns((prev) => ({
          ...prev,
          [courseId]: data
            ? { status: 'ready', data }
            : { status: 'empty' },
        }))
      } catch {
        setDrilldowns((prev) => ({
          ...prev,
          [courseId]: {
            status: 'error',
            message: 'Could not load progress details.',
          },
        }))
      }
    },
    [userId, expanded, drilldowns],
  )

  return (
    <ul className="divide-y">
      {enrollments.map((e) => {
        const isOpen = expanded === e.courseId
        const drill = drilldowns[e.courseId]
        return (
          <li key={e.enrollmentId}>
            <button
              type="button"
              onClick={() => toggle(e.courseId)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/40"
            >
              {isOpen ? (
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">
                    {e.courseTitle}
                  </p>
                  <StatusBadge status={e.status} />
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  Enrolled {fmtDate(e.enrolledAt)} · Last accessed{' '}
                  {relativeTime(e.lastAccessedAt)}
                  {e.completedAt
                    ? ` · Completed ${fmtDate(e.completedAt)}`
                    : ''}
                </p>
              </div>

              <div className="hidden w-40 shrink-0 sm:block">
                <div className="flex items-center gap-2">
                  <Progress value={e.progressPercent} className="h-1.5 flex-1" />
                  <span className="w-9 text-right text-xs tabular-nums">
                    {e.progressPercent}%
                  </span>
                </div>
              </div>
            </button>

            {isOpen ? (
              <div className="border-t bg-muted/20 px-5 py-4">
                {!drill || drill.status === 'loading' ? (
                  <DrilldownSkeleton />
                ) : drill.status === 'error' ? (
                  <p className="text-xs text-destructive">{drill.message}</p>
                ) : drill.status === 'empty' ? (
                  <p className="text-xs text-muted-foreground">
                    No curriculum to show.
                  </p>
                ) : (
                  <CourseDrilldown data={drill.data} />
                )}
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function CourseDrilldown({
  data,
}: {
  data: MemberCourseProgress
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Link
          href={`/admin/courses/${data.courseSlug}`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ExternalLink className="size-3" />
          Open course
        </Link>
      </div>
      {data.chapters.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          This course has no chapters yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {data.chapters.map((ch) => (
            <li
              key={ch.id}
              className="rounded-lg border bg-background"
            >
              <div className="flex flex-col gap-2 border-b px-4 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    {ch.moduleTitle ? (
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {ch.moduleTitle}
                      </p>
                    ) : null}
                    <p className="truncate text-sm font-medium">{ch.title}</p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {ch.completedLessons} / {ch.totalLessons}
                  </span>
                </div>
                {ch.totalLessons > 0 ? (
                  <Progress value={ch.percent} className="h-1" />
                ) : null}
              </div>
              {ch.lessons.length === 0 ? (
                <p className="px-4 py-3 text-xs text-muted-foreground">
                  No lessons yet.
                </p>
              ) : (
                <ul className="divide-y">
                  {ch.lessons.map((l) => (
                    <LessonRow key={l.id} lesson={l} />
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const LESSON_TYPE_ICON = {
  VIDEO: PlayCircle,
  QUIZ: GraduationCap,
  RESOURCE: FileText,
} as const

function LessonRow({
  lesson,
}: {
  lesson: MemberCourseProgress['chapters'][number]['lessons'][number]
}) {
  const Icon = LESSON_TYPE_ICON[lesson.type]
  return (
    <li className="flex items-center gap-3 px-4 py-2">
      {lesson.completed ? (
        <CheckCircle2 className="size-4 shrink-0 text-success" />
      ) : (
        <Circle className="size-4 shrink-0 text-muted-foreground/50" />
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-sm',
            !lesson.completed && 'text-muted-foreground',
          )}
        >
          {lesson.title}
        </p>
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Icon className="size-3" />
          {lesson.type.charAt(0) + lesson.type.slice(1).toLowerCase()}
          {lesson.completed && lesson.completedAt
            ? ` · completed ${fmtDate(lesson.completedAt)}`
            : lesson.watchedPercent > 0
              ? ` · ${lesson.watchedPercent}% watched`
              : ''}
        </p>
      </div>
    </li>
  )
}

// Shimmer placeholder that roughly matches the shape of two chapter
// cards. Chosen to be visually quiet — admins shouldn't be drawn to
// loading state on every expand. ~300ms feels right; longer fetches
// reveal the shimmer for as long as they take.
function DrilldownSkeleton() {
  return (
    <div className="space-y-3" aria-busy aria-label="Loading lesson progress">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-background">
          <div className="flex flex-col gap-2 border-b px-4 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="h-1 w-full" />
          </div>
          <ul className="divide-y">
            {Array.from({ length: 3 }).map((_, j) => (
              <li key={j} className="flex items-center gap-3 px-4 py-2">
                <Skeleton className="size-4 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2.5 w-20" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
