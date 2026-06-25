import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  FolderOpen,
  Infinity as InfinityIcon,
  Layers,
  Play,
  Sparkles,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { EmptyState } from '@/components/shared'
import { CertificateDownloadButton } from '@/components/member/certificate-download-button'
import { CurriculumOutline } from '@/components/member/curriculum-outline'
import { UpNextCard } from '@/components/member/up-next-card'
import { requireActiveUser } from '@/lib/auth'
import { computeLessonGating } from '@/lib/lesson-gating'
import { pickResumeLesson } from '@/lib/services/resume-picker'
import { memberCourseService } from '@/lib/services/member-course-service'
import { startCourseAction } from '../actions'

interface CourseDetailPageProps {
  params: Promise<{ slug: string }>
}

function formatTotalDuration(seconds: number): string | null {
  if (!seconds || seconds <= 0) return null
  const totalMin = Math.round(seconds / 60)
  if (totalMin < 60) return `${totalMin} min`
  const hr = Math.floor(totalMin / 60)
  const min = totalMin % 60
  return min === 0 ? `${hr} hr` : `${hr} hr ${min} min`
}

export default async function CourseDetailPage({
  params,
}: CourseDetailPageProps) {
  const { slug } = await params
  const user = await requireActiveUser()
  const course = await memberCourseService.getBySlug(user.id, slug)
  if (!course) notFound()
  const courseId = course.id

  const started = course.progressPercent > 0
  const completed =
    course.lessonsCount > 0 && course.progressPercent === 100
  const ordered = course.chapters.flatMap((c) => c.lessons)
  const totalSeconds = ordered.reduce(
    (sum, l) => sum + (l.durationSeconds ?? 0),
    0,
  )
  const totalDuration = formatTotalDuration(totalSeconds)
  const gating = computeLessonGating(ordered)
  const upNext = pickResumeLesson(ordered)
  const upNextChapter = upNext
    ? course.chapters.find((c) => c.lessons.some((l) => l.id === upNext.id))
    : null

  return (
    <div className="space-y-8">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2"
        render={<Link href="/courses" />}
      >
        <ArrowLeft />
        All courses
      </Button>

      {/* Compact hero — cover (or branded gradient) on the left,
          title + meta + primary CTA on the right. Replaces the
          empty red block. */}
      <header className="grid gap-6 sm:grid-cols-[minmax(220px,300px)_1fr]">
        <CourseCover
          title={course.title}
          coverImageUrl={course.coverImageUrl}
        />
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Course
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              {course.title}
            </h1>
            {course.description ? (
              <div
                className="text-sm text-muted-foreground [&_a]:text-primary [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: course.description }}
              />
            ) : null}
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {course.modulesCount > 0 ? (
              <span className="flex items-center gap-1.5">
                <FolderOpen className="size-4" />
                {course.modulesCount}{' '}
                {course.modulesCount === 1 ? 'module' : 'modules'}
              </span>
            ) : null}
            <span className="flex items-center gap-1.5">
              <Layers className="size-4" />
              {course.chapters.length}{' '}
              {course.chapters.length === 1 ? 'chapter' : 'chapters'}
            </span>
            <span className="flex items-center gap-1.5">
              <BookOpen className="size-4" />
              {course.lessonsCount}{' '}
              {course.lessonsCount === 1 ? 'lesson' : 'lessons'}
            </span>
            {totalDuration ? (
              <span className="flex items-center gap-1.5">
                <Clock className="size-4" />
                {totalDuration}
              </span>
            ) : null}
            <span className="flex items-center gap-1.5">
              <InfinityIcon className="size-4" />
              {course.accessDays
                ? `${course.accessDays}-day access`
                : 'Lifetime access'}
            </span>
          </div>

          <form
            action={async () => {
              'use server'
              await startCourseAction(courseId)
            }}
          >
            <Button
              type="submit"
              size="lg"
              disabled={course.lessonsCount === 0}
              className="w-full sm:w-auto"
            >
              <Play />
              {completed
                ? 'Replay course'
                : started
                  ? 'Continue learning'
                  : 'Start course'}
            </Button>
          </form>
        </div>
      </header>

      {/* Inline progress strip — only meaningful once started. */}
      {started ? (
        <Card className="gap-3 p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              {completed ? (
                <CheckCircle2 className="size-4 text-success" />
              ) : (
                <Play className="size-4 text-primary" />
              )}
              <span className="font-medium">
                {completed ? 'Course complete' : 'In progress'}
              </span>
              <span className="text-muted-foreground">
                {course.completedLessons} of {course.lessonsCount}{' '}
                {course.lessonsCount === 1 ? 'lesson' : 'lessons'}
              </span>
            </span>
            <span className="text-sm font-medium tabular-nums">
              {course.progressPercent}%
            </span>
          </div>
          <Progress value={course.progressPercent} />
        </Card>
      ) : null}

      {/* Completion celebration — only fires at 100%. The summary
          page lives at /courses/[slug]/complete and shows recap +
          recommended next course. */}
      {completed ? (
        <Card
          variant="raised"
          className="flex flex-col gap-3 border-success/30 bg-success/[0.04] p-6 sm:flex-row sm:items-center"
        >
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
            <Sparkles className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">
              You&apos;ve completed this course
            </h2>
            <p className="text-sm text-muted-foreground">
              All {course.lessonsCount} lessons are done — revisit any
              chapter below, or open your completion summary for what to
              tackle next.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:shrink-0 sm:flex-row">
            {course.certificateTemplateUrl && course.enrollment ? (
              <CertificateDownloadButton
                enrollmentId={course.enrollment.id}
                variant="outline"
              />
            ) : null}
            <Button
              render={<Link href={`/courses/${course.slug}/complete`} />}
            >
              View completion summary
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">
              Curriculum
            </h2>
            <span className="text-xs text-muted-foreground">
              {course.modulesCount > 0
                ? `${course.modulesCount} ${
                    course.modulesCount === 1 ? 'module' : 'modules'
                  } · `
                : ''}
              {course.chapters.length}{' '}
              {course.chapters.length === 1 ? 'chapter' : 'chapters'} ·{' '}
              {course.lessonsCount}{' '}
              {course.lessonsCount === 1 ? 'lesson' : 'lessons'}
            </span>
          </div>
          {course.chapters.length > 0 ? (
            <CurriculumOutline
              modules={course.modules}
              looseChapters={course.looseChapters}
              courseSlug={course.slug}
              unlockedIds={gating.unlockedIds}
            />
          ) : (
            <EmptyState
              icon={BookOpen}
              title="Curriculum coming soon"
              description="This course's lessons are being finalised and will appear here shortly."
            />
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {upNext && upNextChapter && !completed ? (
            <UpNextCard
              chapterTitle={upNextChapter.title}
              lesson={upNext}
              href={`/courses/${course.slug}/lessons/${upNext.id}`}
              ctaLabel={started ? 'Resume' : 'Start lesson'}
            />
          ) : null}

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

function CourseCover({
  title,
  coverImageUrl,
}: {
  title: string
  coverImageUrl: string | null
}) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 ring-1 ring-foreground/[0.06]">
      {coverImageUrl ? (
        <Image
          src={coverImageUrl}
          alt={title}
          fill
          priority
          sizes="(min-width: 1024px) 300px, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-5xl font-bold tracking-tight text-white/85">
            {title.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
    </div>
  )
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Layers
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
