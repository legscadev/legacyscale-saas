import Image from 'next/image'
import { ArrowRight, PlayCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { resumeCourseAction } from '@/app/(user)/courses/actions'
import type { MemberCatalogCourse } from '@/lib/services/member-course-service'

interface ContinueHeroProps {
  course: MemberCatalogCourse
}

export function ContinueHero({ course }: ContinueHeroProps) {
  // We don't have per-lesson detail in the catalog payload, so the
  // "next lesson" position is derived from completed-count + 1. Filter
  // already guarantees percent < 100, so this never overflows total.
  const completed = course.progress?.completed ?? 0
  const total = course.lessonsCount
  const nextLessonNumber = Math.min(completed + 1, Math.max(total, 1))
  const percent = course.progress?.percent ?? 0
  const coverSrc = course.coverImageUrl ?? course.thumbnailUrl

  return (
    <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 text-white shadow-lg">
      {coverSrc ? (
        <Image
          src={coverSrc}
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 1024px, 100vw"
          className="object-cover"
        />
      ) : null}
      {/* Readability scrim — leans left so the right side can breathe
          when the cover image has prominent subjects. */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/15" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

      <div className="relative grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-end md:gap-10 md:p-10">
        <div className="max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium uppercase tracking-wider backdrop-blur">
            <PlayCircle className="size-3.5" />
            Continue learning
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl md:text-4xl">
              {course.title}
            </h2>
            {course.description ? (
              <p className="line-clamp-2 max-w-xl text-sm text-white/80 sm:text-base">
                {course.description}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/85">
            <span className="font-medium">
              Lesson {nextLessonNumber} of {total}
            </span>
            <span aria-hidden className="text-white/40">
              •
            </span>
            <span className="tabular-nums">{percent}% complete</span>
          </div>

          <div className="space-y-2 pt-1">
            <Progress
              value={percent}
              className="h-2 bg-white/20 [&>div]:bg-white"
            />
          </div>
        </div>

        <form action={resumeCourseAction}>
          <input type="hidden" name="courseId" value={course.id} />
          <Button
            type="submit"
            size="lg"
            className="bg-white text-foreground shadow-md hover:bg-white/90"
          >
            Resume
            <ArrowRight />
          </Button>
        </form>
      </div>
    </section>
  )
}
