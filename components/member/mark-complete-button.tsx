'use client'

import { useState } from 'react'
import { Check, CircleCheck } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

/**
 * Visual stub for now — Phase C wires the actual write to
 * lesson_progress via POST /api/progress/[lessonId]/complete.
 */
export function MarkCompleteButton({
  initialComplete = false,
}: {
  initialComplete?: boolean
}) {
  const [done, setDone] = useState(initialComplete)

  const toggle = () => {
    const next = !done
    setDone(next)
    toast.success(next ? 'Lesson marked complete' : 'Marked as incomplete')
  }

  return (
    <Button variant={done ? 'secondary' : 'default'} onClick={toggle}>
      {done ? <CircleCheck /> : <Check />}
      {done ? 'Completed' : 'Mark complete'}
    </Button>
  )
}
