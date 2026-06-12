import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { after } from 'next/server'
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  GraduationCap,
  Infinity as InfinityIcon,
  Layers,
  PlayCircle,
  type LucideIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CurriculumOutline } from '@/components/member/curriculum-outline'
import { LessonBody } from '@/components/member/lesson-body'
import { UpNextCard } from '@/components/member/up-next-card'
import { requireActiveUser } from '@/lib/auth'
import { computeLessonGating } from '@/lib/lesson-gating'
import {
  memberCourseService,
  type MemberCourseDetail,
} from '@/lib/services/member-course-service'

type OrderedLesson = MemberCourseDetail['chapters'][number]['lessons'][number]

interface LessonPlayerPageProps {
  params: Promise<{ courseId: string; lessonId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Walk in `direction` (-1 prev, +1 next) until we hit a lesson the
 * user can actually open. Skips status-locked (PROCESSING / DRAFT)
 * and gating-locked (sequential-unlock) lessons so Prev/Next never
 * land somewhere the user can't play.
 */
function findPlayable(
  lessons: OrderedLesson[],
  unlockedIds: Set<string>,
  fromIdx: number,
  direction: -1 | 1,
): OrderedLesson | undefined {
  for (let i = fromIdx + direction; i >= 0 && i < lessons.length; i += direction) {
    const lesson = lessons[i]!
    if (lesson.status === 'READY' && unlockedIds.has(lesson.id)) {
      return lesson
    }
  }
  return undefined
}

export default async function LessonPlayerPage({
  params,
  searchParams,
}: LessonPlayerPageProps) {
  const { courseId, lessonId } = await params
  const sp = await searchParams
  const autoPlay = sp.autoplay === '1'
  const user = await requireActiveUser()
  const course = await memberCourseService.getById(user.id, courseId)
  if (!course) notFound()

  const ordered = course.chapters.flatMap((c) => c.lessons)
  const pos = ordered.findIndex((l) => l.id === lessonId)
  if (pos < 0) notFound()
  const lesson = ordered[pos]!
  const chapter = course.chapters.find((c) =>
    c.lessons.some((l) => l.id === lessonId),
  )!

  // Sequential unlock — bounce a deep-link to a locked lesson back
  // to the user's current frontier (or the course detail page if
  // the course has no playable lessons at all).
  const gating = computeLessonGating(ordered)
  if (!gating.unlockedIds.has(lesson.id)) {
    if (gating.frontierId) {
      redirect(`/courses/${course.id}/lessons/${gating.frontierId}`)
    }
    redirect(`/courses/${course.id}`)
  }

  const prev = findPlayable(ordered, gating.unlockedIds, pos, -1)
  const next = findPlayable(ordered, gating.unlockedIds, pos, 1)
  // Next-in-order ignoring gating — the autoplay overlay only fires
  // after the video ends, which auto-marks the current lesson
  // complete and lifts the gate on this very next lesson.
  const nextInOrder = ordered
    .slice(pos + 1)
    .find((l) => l.status === 'READY')

  // Touch progress + enrollment lastAccessedAt after the response so
  // the resume picker has fresh data without slowing the render.
  after(() => memberCourseService.recordLessonView(user.id, lesson.id))

  const chapterNumber =
    course.chapters.findIndex((c) => c.id === chapter.id) + 1
  // Resolve the parent module (if any) for the breadcrumb. Loose
  // chapters surface no module label.
  const parentModule =
    course.modules.find((m) =>
      m.chapters.some((c) => c.id === chapter.id),
    ) ?? null
  const upNextChapter = nextInOrder
    ? course.chapters.find((c) =>
        c.lessons.some((l) => l.id === nextInOrder.id),
      )
    : null
  const { Icon: TypeIcon, label: typeLabel } = lessonTypeMeta(lesson.type)
  const lessonDuration = formatDuration(lesson.durationSeconds)
  const totalSeconds = ordered.reduce(
    (sum, l) => sum + (l.durationSeconds ?? 0),
    0,
  )
  const totalDuration = formatTotalDuration(totalSeconds)
  const courseCompleted =
    course.lessonsCount > 0 && course.progressPercent === 100
  const isLastReady = !nextInOrder

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2"
          render={<Link href={`/courses/${course.id}`} />}
        >
          <ArrowLeft />
          <span className="truncate">{course.title}</span>
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!prev}
            render={
              prev ? (
                <Link href={`/courses/${course.id}/lessons/${prev.id}`} />
              ) : undefined
            }
          >
            <ChevronLeft />
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!next}
            render={
              next ? (
                <Link href={`/courses/${course.id}/lessons/${next.id}`} />
              ) : undefined
            }
          >
            Next
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-5">
          {/* Lesson header — eyebrow with chapter + position + type +
              duration, then the lesson title. More substantial than
              the bare CHAPTER label we had before. */}
          <header className="space-y-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {parentModule ? (
                <>
                  <span>{parentModule.title}</span>
                  <span aria-hidden className="text-muted-foreground/40">
                    •
                  </span>
                </>
              ) : null}
              <span>
                Chapter {String(chapterNumber).padStart(2, '0')} ·{' '}
                {chapter.title}
              </span>
              <span aria-hidden className="text-muted-foreground/40">
                •
              </span>
              <span>
                Lesson {pos + 1} of {ordered.length}
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {lesson.title}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <TypeIcon className="size-3.5" />
                {typeLabel}
              </span>
              {lessonDuration ? (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  {lessonDuration}
                </span>
              ) : null}
            </div>
          </header>

          <LessonBody
            lesson={lesson}
            autoPlay={autoPlay}
            nextHref={
              nextInOrder
                ? `/courses/${course.id}/lessons/${nextInOrder.id}`
                : undefined
            }
            nextTitle={nextInOrder?.title}
          />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="gap-0 p-0">
            <div className="space-y-3 border-b p-4">
              <div>
                <p className="text-sm font-semibold">Course content</p>
                <p className="truncate text-xs text-muted-foreground">
                  {course.title}
                </p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {course.completedLessons} of {course.lessonsCount}{' '}
                    {course.lessonsCount === 1 ? 'lesson' : 'lessons'}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {course.progressPercent}%
                  </span>
                </div>
                <Progress value={course.progressPercent} />
              </div>
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-3">
              <CurriculumOutline
                modules={course.modules}
                looseChapters={course.looseChapters}
                courseId={course.id}
                activeLessonId={lesson.id}
                variant="sidebar"
                unlockedIds={gating.unlockedIds}
              />
            </div>
          </Card>

          {nextInOrder && upNextChapter ? (
            <UpNextCard
              chapterTitle={upNextChapter.title}
              lesson={nextInOrder}
              href={`/courses/${course.id}/lessons/${nextInOrder.id}`}
              ctaLabel="Play next"
            />
          ) : isLastReady && !courseCompleted ? (
            <Card variant="raised" className="gap-2 p-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Last lesson
              </p>
              <p className="text-sm font-semibold leading-snug">
                You&apos;re on the final lesson
              </p>
              <p className="text-xs text-muted-foreground">
                Finish this video and the course will be marked complete.
              </p>
            </Card>
          ) : courseCompleted ? (
            <Card
              variant="raised"
              className="gap-2 border-success/30 bg-success/[0.04] p-5"
            >
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-success">
                <CheckCircle2 className="size-3.5" />
                Course complete
              </p>
              <p className="text-sm font-semibold leading-snug">
                Nicely done — every lesson is checked off.
              </p>
              <p className="text-xs text-muted-foreground">
                Revisit any lesson to refresh, or head back to the catalog
                for your next track.
              </p>
            </Card>
          ) : null}

          {/* Always-on details card balances the right column when the
              curriculum is short and there's no Up-Next CTA. */}
          <Card className="gap-3 p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Course details
            </p>
            <dl className="space-y-2.5 text-sm">
              <DetailRow
                icon={Layers}
                label="Chapters"
                value={String(course.chapters.length)}
              />
              <DetailRow
                icon={BookOpen}
                label="Lessons"
                value={String(course.lessonsCount)}
              />
              {totalDuration ? (
                <DetailRow
                  icon={Clock}
                  label="Total time"
                  value={totalDuration}
                />
              ) : null}
              <DetailRow
                icon={InfinityIcon}
                label="Access"
                value={
                  course.accessDays
                    ? `${course.accessDays} days`
                    : 'Lifetime'
                }
              />
            </dl>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function lessonTypeMeta(type: OrderedLesson['type']): {
  Icon: LucideIcon
  label: string
} {
  if (type === 'VIDEO') return { Icon: PlayCircle, label: 'Video lesson' }
  if (type === 'QUIZ') return { Icon: GraduationCap, label: 'Quiz' }
  return { Icon: FileText, label: 'Resource' }
}

function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatTotalDuration(seconds: number): string | null {
  if (!seconds || seconds <= 0) return null
  const totalMin = Math.round(seconds / 60)
  if (totalMin < 60) return `${totalMin} min`
  const hr = Math.floor(totalMin / 60)
  const min = totalMin % 60
  return min === 0 ? `${hr} hr` : `${hr} hr ${min} min`
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}
