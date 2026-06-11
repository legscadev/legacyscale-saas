'use client'

import { useTransition } from 'react'
import { Check, CircleCheck, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { setLessonCompleteAction } from '@/app/(user)/courses/[courseId]/lessons/[lessonId]/actions'

interface MarkCompleteButtonProps {
  lessonId: string
  completed: boolean
}

export function MarkCompleteButton({
  lessonId,
  completed,
}: MarkCompleteButtonProps) {
  const [isPending, startTransition] = useTransition()

  const toggle = () => {
    const next = !completed
    startTransition(async () => {
      const result = await setLessonCompleteAction(lessonId, next)
      if (result.ok) {
        toast.success(next ? 'Lesson marked complete' : 'Marked as incomplete')
      } else {
        toast.error(result.error ?? 'Could not update progress')
      }
    })
  }

  return (
    <Button
      variant={completed ? 'secondary' : 'default'}
      onClick={toggle}
      disabled={isPending}
    >
      {isPending ? (
        <Loader2 className="animate-spin" />
      ) : completed ? (
        <CircleCheck />
      ) : (
        <Check />
      )}
      {isPending
        ? completed
          ? 'Unmarking…'
          : 'Marking…'
        : completed
          ? 'Completed'
          : 'Mark complete'}
    </Button>
  )
}
