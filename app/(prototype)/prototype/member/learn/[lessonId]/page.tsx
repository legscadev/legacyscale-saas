import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageContainer } from "@/components/prototype/shared/page-container"
import { CurriculumOutline } from "@/components/prototype/courses/curriculum-outline"
import { VideoFrame } from "@/components/prototype/learn/video-frame"
import { NotesPanel } from "@/components/prototype/learn/notes-panel"
import { QuizRunner } from "@/components/prototype/learn/quiz-runner"
import { ResourceView } from "@/components/prototype/learn/resource-view"
import { MarkCompleteButton } from "@/components/prototype/learn/mark-complete-button"
import { findLesson } from "@/lib/prototype"

export default async function LessonPlayer({
  params,
}: {
  params: Promise<{ lessonId: string }>
}) {
  const { lessonId } = await params
  const found = findLesson(lessonId)
  if (!found) notFound()
  const { course, chapter, lesson } = found

  const ordered = course.chapters.flatMap((c) => c.lessons)
  const pos = ordered.findIndex((l) => l.id === lesson.id)
  const prev = pos > 0 ? ordered[pos - 1] : undefined
  const next = pos < ordered.length - 1 ? ordered[pos + 1] : undefined

  return (
    <PageContainer size="wide" animate={false}>
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2"
          render={<Link href={`/prototype/member/courses/${course.id}`} />}
        >
          <ArrowLeft />
          {course.title}
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!prev}
            render={
              prev ? (
                <Link href={`/prototype/member/learn/${prev.id}`} />
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
                <Link href={`/prototype/member/learn/${next.id}`} />
              ) : undefined
            }
          >
            Next
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {chapter.title}
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">
              {lesson.title}
            </h1>
          </div>

          {lesson.type === "VIDEO" ? (
            <>
              <VideoFrame
                durationSeconds={lesson.durationSeconds ?? 0}
                positionSeconds={lesson.lastPositionSec}
                title={lesson.title}
              />
              <div className="flex justify-end">
                <MarkCompleteButton initialComplete={lesson.completed} />
              </div>
              <Card className="gap-0 p-0">
                <Tabs defaultValue="overview" className="p-4">
                  <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="notes">Notes</TabsTrigger>
                  </TabsList>
                  <TabsContent value="overview" className="pt-4">
                    <p className="text-sm text-muted-foreground">
                      {lesson.description}
                    </p>
                  </TabsContent>
                  <TabsContent value="notes" className="pt-4">
                    <NotesPanel />
                  </TabsContent>
                </Tabs>
              </Card>
            </>
          ) : null}

          {lesson.type === "QUIZ" ? <QuizRunner lesson={lesson} /> : null}

          {lesson.type === "RESOURCE" ? (
            <>
              <ResourceView lesson={lesson} />
              <div className="flex justify-end">
                <MarkCompleteButton initialComplete={lesson.completed} />
              </div>
            </>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card className="gap-0 p-0">
            <div className="border-b p-4">
              <p className="text-sm font-semibold">Course content</p>
              <p className="text-xs text-muted-foreground">{course.title}</p>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-3 scrollbar-thin">
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
    </PageContainer>
  )
}
