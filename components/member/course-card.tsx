import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, BookOpen, Clock, PlayCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn, htmlToPlainText } from '@/lib/utils'
import type { MemberCatalogCourse } from '@/lib/services/member-course-service'

interface MemberCourseCardProps {
  course: MemberCatalogCourse
  index?: number
}

function formatTotalDuration(seconds: number): string {
  const totalMin = Math.round(seconds / 60)
  if (totalMin < 60) return `${totalMin} min`
  const hr = Math.floor(totalMin / 60)
  const min = totalMin % 60
  return min === 0 ? `${hr} hr` : `${hr}h ${min}m`
}

export function MemberCourseCard({ course, index = 0 }: MemberCourseCardProps) {
  const href = `/courses/${course.slug}`
  const started =
    course.progress != null && course.progress.percent > 0

  return (
    <Card
      className="group h-full gap-0 overflow-hidden p-0 transition-all hover:-translate-y-1 hover:ring-primary/30 hover:shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500"
      style={{
        animationDelay: `${index * 80}ms`,
        animationFillMode: 'backwards',
      }}
    >
      <Link href={href} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-brand-500 to-brand-700">
          {course.thumbnailUrl ? (
            <Image
              src={course.thumbnailUrl}
              alt={course.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <PlayCircle className="size-9 text-white/90 transition-transform group-hover:scale-110" />
            </div>
          )}
          <span className="absolute right-2 top-2 rounded-full bg-black/35 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
            {course.accessDays
              ? `${course.accessDays}-day access`
              : 'Lifetime'}
          </span>
          {course.isFree ? (
            <span className="absolute left-2 top-2 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-white">
              Free
            </span>
          ) : null}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <Link href={href}>
          <h3 className="line-clamp-1 font-medium transition-colors group-hover:text-primary">
            {course.title}
          </h3>
        </Link>
        {course.description ? (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {htmlToPlainText(course.description)}
          </p>
        ) : null}

        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <BookOpen className="size-3" />
            {course.lessonsCount}{' '}
            {course.lessonsCount === 1 ? 'lesson' : 'lessons'}
          </span>
          {course.durationSeconds > 0 ? (
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {formatTotalDuration(course.durationSeconds)}
            </span>
          ) : null}
        </div>

        {course.progress && course.progress.total > 0 ? (
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium tabular-nums">
                {course.progress.percent}%
              </span>
            </div>
            <Progress value={course.progress.percent} />
          </div>
        ) : null}

        {/* Wrapper pins the CTA to the bottom of the flex column so
            cards with different-length descriptions still line up.
            pt-4 preserves the visual gap above the button; mt-auto
            fills the remaining vertical space in the card. */}
        <div className="mt-auto pt-4">
          <Button className={cn('w-full')} render={<Link href={href} />}>
            {started ? 'Continue' : 'Start course'}
            <ArrowRight />
          </Button>
        </div>
      </div>
    </Card>
  )
}
