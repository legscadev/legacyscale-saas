import { Loader2 } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MuxLessonPlayer } from './mux-lesson-player'
import { MarkCompleteButton } from './mark-complete-button'
import { NotesPanel } from './notes-panel'
import { QuizRunner } from './quiz-runner'
import { ResourceView } from './resource-view'
import type { MemberCourseDetail } from '@/lib/services/member-course-service'

type Lesson = MemberCourseDetail['chapters'][number]['lessons'][number]

interface LessonBodyProps {
  lesson: Lesson
}

export function LessonBody({ lesson }: LessonBodyProps) {
  const completed = lesson.progress?.completed ?? false

  if (lesson.type === 'VIDEO') {
    return (
      <>
        {lesson.muxPlaybackId ? (
          <MuxLessonPlayer
            lessonId={lesson.id}
            playbackId={lesson.muxPlaybackId}
            title={lesson.title}
            startSeconds={lesson.progress?.lastPositionSec ?? 0}
            alreadyComplete={completed}
          />
        ) : (
          <Card className="flex flex-col items-center gap-3 p-10 text-center">
            <span className="grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </span>
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold">
                Video is still processing
              </h2>
              <p className="max-w-md text-sm text-muted-foreground">
                Hang tight — Mux is encoding this upload. It&apos;ll show
                up here as soon as it&apos;s ready.
              </p>
            </div>
          </Card>
        )}
        <div className="flex justify-end">
          <MarkCompleteButton lessonId={lesson.id} completed={completed} />
        </div>
        <Card className="gap-0 p-0">
          <Tabs defaultValue="overview" className="p-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="pt-4">
              {lesson.description ? (
                <p className="text-sm text-muted-foreground">
                  {lesson.description}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No overview for this lesson yet.
                </p>
              )}
            </TabsContent>
            <TabsContent value="notes" className="pt-4">
              <NotesPanel />
            </TabsContent>
          </Tabs>
        </Card>
      </>
    )
  }

  if (lesson.type === 'RESOURCE') {
    return (
      <>
        <ResourceView
          title={lesson.title}
          description={lesson.description}
          resources={lesson.resources}
        />
        <div className="flex justify-end">
          <MarkCompleteButton lessonId={lesson.id} completed={completed} />
        </div>
      </>
    )
  }

  // QUIZ — auto-completes on pass; explicit Mark Complete still
  // available for instructors / re-marks.
  return (
    <>
      <QuizRunner
        lessonId={lesson.id}
        title={lesson.title}
        description={lesson.description}
        questions={lesson.quizQuestions}
        passingScore={lesson.passingScore}
        maxAttempts={lesson.maxAttempts}
        timeLimitMin={lesson.timeLimitMin}
      />
      <div className="flex justify-end">
        <MarkCompleteButton lessonId={lesson.id} completed={completed} />
      </div>
    </>
  )
}
