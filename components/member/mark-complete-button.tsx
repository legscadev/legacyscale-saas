'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, CircleCheck, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { setLessonCompleteAction } from '@/app/(user)/courses/[courseId]/lessons/[lessonId]/actions'

interface MarkCompleteButtonProps {
  lessonId: string
  completed: boolean
  /** When provided, a successful mark-complete (i.e. transition from
   *  incomplete → complete) auto-advances to this URL. Unmarking
   *  stays put. Omit on the last lesson of a course. */
  nextHref?: string
}

export function MarkCompleteButton({
  lessonId,
  completed,
  nextHref,
}: MarkCompleteButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  // Distinct "we've already marked complete and are now navigating"
  // state — gives the operator a clear "Moving to next lesson…" cue
  // instead of the generic "Marking…" sitting there during the route
  // change. Stays true until this component unmounts on navigation.
  const [navigating, setNavigating] = useState(false)

  const toggle = () => {
    const next = !completed
    startTransition(async () => {
      const result = await setLessonCompleteAction(lessonId, next)
      if (!result.ok) {
        toast.error(result.error ?? 'Could not update progress')
        return
      }
      toast.success(next ? 'Lesson marked complete' : 'Marked as incomplete')
      if (next && nextHref) {
        setNavigating(true)
        router.push(nextHref)
      }
    })
  }

  const busy = isPending || navigating

  return (
    <Button
      variant={completed ? 'secondary' : 'default'}
      onClick={toggle}
      disabled={busy}
      aria-live="polite"
    >
      {navigating ? (
        <ArrowRight className="animate-pulse" />
      ) : isPending ? (
        <Loader2 className="animate-spin" />
      ) : completed ? (
        <CircleCheck />
      ) : (
        <Check />
      )}
      {navigating
        ? 'Moving to next lesson…'
        : isPending
          ? completed
            ? 'Unmarking…'
            : 'Marking…'
          : completed
            ? 'Completed'
            : 'Mark complete'}
    </Button>
  )
}
