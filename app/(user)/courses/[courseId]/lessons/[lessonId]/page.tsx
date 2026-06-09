import Link from 'next/link'
import { ArrowLeft, Hammer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface LessonPlayerStubProps {
  params: Promise<{ courseId: string; lessonId: string }>
}

/**
 * Phase B (Sprint 4) replaces this with the full player layout —
 * sidebar with chapter/lesson list + main content area routing on
 * lesson type. For now this stub confirms enrolment + routing land
 * on the right URL.
 */
export default async function LessonPlayerStubPage({
  params,
}: LessonPlayerStubProps) {
  const { courseId, lessonId } = await params
  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2"
        render={<Link href={`/courses/${courseId}`} />}
      >
        <ArrowLeft />
        Back to course
      </Button>

      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <span className="grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
          <Hammer className="size-6" />
        </span>
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold">Player coming soon</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            You&apos;re enrolled and the URL is wired up. The full player
            (video, sidebar, navigation) ships in the next phase.
          </p>
        </div>
        <p className="font-mono text-xs text-muted-foreground/60">
          {courseId} · {lessonId}
        </p>
      </Card>
    </div>
  )
}
