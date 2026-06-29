import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  Trophy,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { requireActiveUser } from '@/lib/auth'
import { memberCourseService } from '@/lib/services/member-course-service'
import { htmlToPlainText } from '@/lib/utils'

interface CompletionPageProps {
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

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

export default async function CourseCompletePage({
  params,
}: CompletionPageProps) {
  const { slug } = await params
  const user = await requireActiveUser()
  const course = await memberCourseService.getBySlug(user.id, slug)
  if (!course) notFound()
  // Gate the page on a real completion. Direct-link visitors who
  // haven't finished get a 404 — same as a missing course — so
  // there's no leakage of completion UX before it's earned.
  if (!course.enrollment?.completedAt) notFound()

  const totalSeconds = course.chapters
    .flatMap((c) => c.lessons)
    .reduce((sum, l) => sum + (l.durationSeconds ?? 0), 0)
  const totalDuration = formatTotalDuration(totalSeconds)
  const completedOn = DATE_FMT.format(course.enrollment.completedAt)

  const suggestion = await memberCourseService.suggestNextCourse(
    user.id,
    course.id,
  )

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-6">
      {/* Hero: large trophy + congratulatory copy. Ambient glow sits
          behind the icon for a subtle celebratory accent. */}
      <header className="relative flex flex-col items-center text-center">
        <div
          aria-hidden
          className="absolute top-2 size-48 -translate-y-2 rounded-full bg-success/20 blur-3xl motion-safe:animate-breathe"
        />
        <div className="relative grid size-20 place-items-center rounded-2xl bg-success/15 text-success ring-4 ring-success/20">
          <Trophy className="size-10" />
        </div>
        <p className="relative mt-5 text-[11px] font-medium uppercase tracking-[0.18em] text-success">
          Course complete
        </p>
        <h1 className="relative mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Nicely done — {course.title}
        </h1>
        <p className="relative mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
          You finished every lesson on {completedOn}. Revisit any chapter
          whenever you want — you keep access for as long as your enrollment
          allows.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          icon={CheckCircle2}
          label="Lessons completed"
          value={`${course.completedLessons} of ${course.lessonsCount}`}
        />
        <StatTile
          icon={Layers}
          label="Chapters covered"
          value={String(course.chapters.length)}
        />
        <StatTile
          icon={Clock}
          label="Time invested"
          value={totalDuration ?? '—'}
        />
      </div>

      {suggestion ? (
        <Card variant="raised" className="gap-4 p-6">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            <Sparkles className="size-3.5" />
            What&apos;s next
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="truncate text-lg font-semibold tracking-tight">
                {suggestion.title}
              </p>
              {suggestion.description ? (
                // Strip HTML to plain text — same rationale as commit
                // 731e189 on the dashboard CourseCard. A `<p>` from
                // dangerouslySetInnerHTML inside this `<p>` wrapper
                // causes a hydration mismatch (browsers auto-close
                // the outer `<p>` on the nested one), and a line-
                // clamped preview has no use for rich formatting.
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {htmlToPlainText(suggestion.description)}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {suggestion.reason === 'sameCategory'
                    ? 'Picked because it lives in the same category as this course.'
                    : 'From your enrolled courses — keep your streak going.'}
                </p>
              )}
            </div>
            <Button
              size="lg"
              className="sm:shrink-0"
              render={<Link href={`/courses/${suggestion.slug}`} />}
            >
              Open course
              <ArrowRight />
            </Button>
          </div>
        </Card>
      ) : null}

      {course.certificateEnabled ? (
        <Card variant="raised" className="flex flex-col gap-3 border-success/30 bg-success/[0.04] p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-semibold">Your certificates are ready</p>
            <p className="text-xs text-muted-foreground">
              One personalised PDF per module — download them from the Certificates tab.
            </p>
          </div>
          <Button
            variant="outline"
            className="sm:shrink-0"
            render={<Link href="/certificates" />}
          >
            View certificates
          </Button>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="outline"
          render={<Link href={`/courses/${course.slug}`} />}
        >
          Revisit this course
        </Button>
        <Button render={<Link href="/courses" />}>
          Back to My Courses
          <ArrowRight />
        </Button>
      </div>
    </div>
  )
}

interface StatTileProps {
  icon: typeof CheckCircle2
  label: string
  value: string
}

function StatTile({ icon: Icon, label, value }: StatTileProps) {
  return (
    <Card className="gap-1 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </Card>
  )
}
