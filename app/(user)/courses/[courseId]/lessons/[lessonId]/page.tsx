import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CurriculumOutline } from '@/components/member/curriculum-outline'
import { LessonBody } from '@/components/member/lesson-body'
import { requireActiveUser } from '@/lib/auth'
import { memberCourseService } from '@/lib/services/member-course-service'

interface LessonPlayerPageProps {
  params: Promise<{ courseId: string; lessonId: string }>
}

export default async function LessonPlayerPage({
  params,
}: LessonPlayerPageProps) {
  const { courseId, lessonId } = await params
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
  const prev = pos > 0 ? ordered[pos - 1] : undefined
  const next = pos < ordered.length - 1 ? ordered[pos + 1] : undefined

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
        <div className="min-w-0 space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {chapter.title}
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">
              {lesson.title}
            </h1>
          </div>

          <LessonBody lesson={lesson} />
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
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
            <div className="max-h-[70vh] overflow-y-auto p-3">
              <CurriculumOutline
                chapters={course.chapters}
                courseId={course.id}
                activeLessonId={lesson.id}
                variant="sidebar"
              />
            </div>
          </Card>
        </aside>
      </div>
    </div>
  )
}
