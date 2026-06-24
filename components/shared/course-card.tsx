import Image from 'next/image'
import Link from 'next/link'
import { BookOpen, Play } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn, htmlToPlainText } from '@/lib/utils'
import { CourseProgress } from './progress-bar'
import { BadgeArchived, BadgeDraft, BadgePublished } from './badge-status'

interface CourseCardProps {
  course: {
    id: string
    title: string
    description?: string | null
    thumbnailUrl?: string | null
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
    lessonsCount?: number
    chaptersCount?: number
  }
  progress?: { completed: number; total: number }
  href?: string
  className?: string
}

function StatusBadge({ status }: { status: CourseCardProps['course']['status'] }) {
  if (status === 'PUBLISHED') return <BadgePublished />
  if (status === 'ARCHIVED') return <BadgeArchived />
  return <BadgeDraft />
}

export function CourseCard({ course, progress, href, className }: CourseCardProps) {
  const thumbnail = (
    <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-gradient-to-br from-brand-500 to-brand-700">
      {course.thumbnailUrl ? (
        <Image
          src={course.thumbnailUrl}
          alt={course.title}
          fill
          className="object-cover"
        />
      ) : (
        <Play className="size-10 text-white/90 transition-transform group-hover:scale-110" />
      )}
    </div>
  )

  return (
    <Card
      className={cn(
        'group gap-0 overflow-hidden p-0 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5',
        className
      )}
    >
      {href ? (
        <Link href={href} className="block">
          {thumbnail}
        </Link>
      ) : (
        thumbnail
      )}

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          {href ? (
            <Link href={href}>
              <h3 className="line-clamp-2 font-semibold transition-colors group-hover:text-primary">
                {course.title}
              </h3>
            </Link>
          ) : (
            <h3 className="line-clamp-2 font-semibold">{course.title}</h3>
          )}
          <StatusBadge status={course.status} />
        </div>

        {course.description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {htmlToPlainText(course.description)}
          </p>
        )}

        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          {course.chaptersCount !== undefined && (
            <span className="flex items-center gap-1">
              <BookOpen className="size-3" />
              {course.chaptersCount} chapters
            </span>
          )}
          {course.lessonsCount !== undefined && (
            <span className="flex items-center gap-1">
              <Play className="size-3" />
              {course.lessonsCount} lessons
            </span>
          )}
        </div>

        {progress && (
          <CourseProgress
            completed={progress.completed}
            total={progress.total}
            className="mt-3"
          />
        )}
      </div>
    </Card>
  )
}
