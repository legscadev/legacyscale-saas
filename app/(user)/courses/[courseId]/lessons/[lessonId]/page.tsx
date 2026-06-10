import Link from 'next/link'
import { notFound } from 'next/navigation'
import { after } from 'next/server'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CurriculumOutline } from '@/components/member/curriculum-outline'
import { LessonBody } from '@/components/member/lesson-body'
import { requireActiveUser } from '@/lib/auth'
import {
  memberCourseService,
  type MemberCourseDetail,
} from '@/lib/services/member-course-service'

type OrderedLesson = MemberCourseDetail['chapters'][number]['lessons'][number]

interface LessonPlayerPageProps {
  params: Promise<{ courseId: string; lessonId: string }>
}

/**
 * Walk in `direction` (-1 prev, +1 next) until we hit a lesson the
 * user can actually open. Locked lessons (PROCESSING / DRAFT) are
 * skipped so Prev/Next never strand the user on a card they can't
 * play.
 */
function findPlayable(
  lessons: OrderedLesson[],
  fromIdx: number,
  direction: -1 | 1,
): OrderedLesson | undefined {
  for (let i = fromIdx + direction; i >= 0 && i < lessons.length; i += direction) {
    if (lessons[i]!.status === 'READY') return lessons[i]
  }
  return undefined
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
  const prev = findPlayable(ordered, pos, -1)
  const next = findPlayable(ordered, pos, 1)

  // Touch progress + enrollment lastAccessedAt after the response so
  // the resume picker has fresh data without slowing the render.
  after(() => memberCourseService.recordLessonView(user.id, lesson.id))

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
