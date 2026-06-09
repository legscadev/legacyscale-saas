import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Infinity as InfinityIcon,
  Play,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { EmptyState } from '@/components/shared'
import { CurriculumOutline } from '@/components/member/curriculum-outline'
import { requireActiveUser } from '@/lib/auth'
import { memberCourseService } from '@/lib/services/member-course-service'
import { startCourseAction } from '../actions'

interface CourseDetailPageProps {
  params: Promise<{ courseId: string }>
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
  const { courseId } = await params
  const user = await requireActiveUser()
  const course = await memberCourseService.getById(user.id, courseId)
  if (!course) notFound()

  const started = course.progressPercent > 0
  const totalSeconds = course.chapters
    .flatMap((c) => c.lessons)
    .reduce((sum, l) => sum + (l.durationSeconds ?? 0), 0)
  const totalDuration = formatTotalDuration(totalSeconds)

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2"
        render={<Link href="/courses" />}
      >
        <ArrowLeft />
        All courses
      </Button>

      <div className="relative overflow-hidden rounded-2xl">
        {course.coverImageUrl ? (
          <>
            <div className="relative aspect-video w-full">
              <Image
                src={course.coverImageUrl}
                alt={course.title}
                fill
                priority
                sizes="(min-width: 1024px) 1024px, 100vw"
                className="object-cover"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
          </>
        ) : (
          <div className="aspect-video bg-gradient-to-br from-brand-500 to-brand-700" />
        )}
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
          <h1 className="max-w-2xl text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {course.title}
          </h1>
          {course.description ? (
            <p
              className="mt-2 max-w-2xl text-sm text-white/85"
              dangerouslySetInnerHTML={{ __html: course.description }}
            />
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-white/90">
            <span>{course.lessonsCount} lessons</span>
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
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Curriculum</h2>
          {course.chapters.length > 0 ? (
            <CurriculumOutline chapters={course.chapters} />
          ) : (
            <EmptyState
              icon={BookOpen}
              title="Curriculum coming soon"
              description="This course's lessons are being finalised and will appear here shortly."
            />
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="gap-4 p-5">
            {started ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Your progress</span>
                  <span className="font-medium tabular-nums">
                    {course.progressPercent}%
                  </span>
                </div>
                <Progress value={course.progressPercent} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {course.lessonsCount}{' '}
                {course.lessonsCount === 1 ? 'lesson' : 'lessons'} ready when
                you are.
              </p>
            )}
            <form
              action={async () => {
                'use server'
                await startCourseAction(courseId)
              }}
            >
              <Button
                type="submit"
                className="w-full"
                disabled={course.lessonsCount === 0}
              >
                <Play />
                {started ? 'Continue learning' : 'Start course'}
              </Button>
            </form>
          </Card>
        </aside>
      </div>
    </div>
  )
}
