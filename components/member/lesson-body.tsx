import { Download, FileText, Hammer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { VideoFrame } from './video-frame'
import { MarkCompleteButton } from './mark-complete-button'
import { NotesPanel } from './notes-panel'
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
        <VideoFrame
          durationSeconds={lesson.durationSeconds ?? 0}
          positionSeconds={lesson.progress?.lastPositionSec ?? 0}
          title={lesson.title}
        />
        <div className="flex justify-end">
          <MarkCompleteButton initialComplete={completed} />
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
        <Card className="gap-5 p-6">
          <div>
            <h2 className="text-lg font-semibold">{lesson.title}</h2>
            {lesson.description ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {lesson.description}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-4 rounded-xl border p-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-error/10 text-error">
              <FileText className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">Resource attachment</p>
              <p className="text-xs text-muted-foreground">
                Download view lands in Phase E
              </p>
            </div>
            <Button disabled>
              <Download />
              Download
            </Button>
          </div>
        </Card>
        <div className="flex justify-end">
          <MarkCompleteButton initialComplete={completed} />
        </div>
      </>
    )
  }

  // QUIZ
  return (
    <Card
      variant="raised"
      className="flex flex-col items-center gap-3 p-10 text-center"
    >
      <span className="grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
        <Hammer className="size-6" />
      </span>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold">Quiz lands in Phase E</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          The shell is in place. The interactive quiz runner — questions,
          scoring, retake — ships with the completion + non-video flows
          phase.
        </p>
      </div>
    </Card>
  )
}
