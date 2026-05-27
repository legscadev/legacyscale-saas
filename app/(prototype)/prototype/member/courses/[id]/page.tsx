import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Clock, Infinity as InfinityIcon, Play } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { PageContainer } from "@/components/prototype/shared/page-container"
import { EmptyState } from "@/components/prototype/shared/empty-state"
import { CurriculumOutline } from "@/components/prototype/courses/curriculum-outline"
import { BookOpen } from "lucide-react"
import { findCourse, formatMinutes } from "@/lib/prototype"

const PROGRESS: Record<string, number> = { "course-1": 38 }

export default async function CourseDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const course = findCourse(id)
  if (!course) notFound()

  const progress = PROGRESS[course.id]
  const enrolled = progress !== undefined
  const firstIncomplete = course.chapters
    .flatMap((c) => c.lessons)
    .find((l) => !l.completed)

  return (
    <PageContainer size="wide">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 -ml-2"
        render={<Link href="/prototype/member/courses" />}
      >
        <ArrowLeft />
        All courses
      </Button>

      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 p-8 text-white">
        <h1 className="max-w-2xl text-3xl font-bold tracking-tight">
          {course.title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-white/85">
          {course.description}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-white/90">
          <span>{course.lessonCount} lessons</span>
          <span className="flex items-center gap-1.5">
            <Clock className="size-4" />
            {formatMinutes(course.durationMinutes)}
          </span>
          <span className="flex items-center gap-1.5">
            <InfinityIcon className="size-4" />
            {course.accessDays ? `${course.accessDays}-day access` : "Lifetime access"}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <h2 className="mb-4 text-lg font-semibold">Curriculum</h2>
          {course.chapters.length > 0 ? (
            <CurriculumOutline
              chapters={course.chapters}
              courseId={course.id}
            />
          ) : (
            <EmptyState
              icon={BookOpen}
              title="Curriculum coming soon"
              description="This program's lessons are being finalized and will appear here shortly."
            />
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="gap-4 p-5">
            {enrolled ? (
              <>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Your progress</span>
                    <span className="font-medium tabular-nums">{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
                <Button
                  className="w-full"
                  render={
                    <Link
                      href={`/prototype/member/learn/${firstIncomplete?.id ?? course.chapters[0]?.lessons[0]?.id}`}
                    />
                  }
                >
                  <Play />
                  Continue learning
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Get full, instant access to every lesson in this program.
                </p>
                <Button className="w-full">Enroll now</Button>
              </>
            )}
          </Card>

          <Card className="gap-3 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Instructor
            </p>
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>KV</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">Keanu Vasquez</p>
                <p className="text-xs text-muted-foreground">
                  Founder, Legacy Scale
                </p>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </PageContainer>
  )
}
