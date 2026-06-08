'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { QuizQuestionItem } from '@/lib/services/quiz-service'

interface QuizPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  questions: QuizQuestionItem[]
}

/**
 * Read-only preview of how a member will see the quiz. No submit, no
 * scoring, no attempt rows — just a paginated render of each question
 * with the correct answer pre-marked so the admin can sanity-check
 * the whole thing in one pass.
 */
export function QuizPreviewDialog({
  open,
  onOpenChange,
  questions,
}: QuizPreviewDialogProps) {
  const [index, setIndex] = useState(0)

  // Reset to the first question whenever we re-open (or if the list
  // shrinks behind us).
  useEffect(() => {
    if (open) setIndex(0)
  }, [open])
  useEffect(() => {
    if (index >= questions.length) setIndex(Math.max(0, questions.length - 1))
  }, [index, questions.length])

  if (questions.length === 0) return null
  const safeIndex = Math.min(index, questions.length - 1)
  const current = questions[safeIndex]!
  const options = (current.options as string[]) ?? []
  const isFirst = safeIndex === 0
  const isLast = safeIndex === questions.length - 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Quiz preview</DialogTitle>
          <DialogDescription>
            Question {safeIndex + 1} of {questions.length} · the correct
            answer is highlighted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-base font-medium text-foreground">
            {current.questionText}
          </p>

          <ul className="space-y-2">
            {options.map((opt, i) => {
              const correct = i === current.correctIndex
              return (
                <li key={i}>
                  <div
                    className={cn(
                      'flex items-center gap-3 rounded-md border p-3 text-sm',
                      correct
                        ? 'border-emerald-500/40 bg-emerald-500/5'
                        : 'border-border bg-background',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-flex size-4 shrink-0 items-center justify-center rounded-full border',
                        correct
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-muted-foreground/30',
                      )}
                    >
                      {correct ? <Check className="size-3" /> : null}
                    </span>
                    <span className={cn(correct && 'font-medium')}>{opt}</span>
                  </div>
                </li>
              )
            })}
          </ul>

          {current.explanation ? (
            <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider">
                Explanation
              </p>
              <p>{current.explanation}</p>
            </div>
          ) : null}
        </div>

        <DialogFooter showCloseButton>
          <Button
            type="button"
            variant="outline"
            disabled={isFirst}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            <ArrowLeft />
            Previous
          </Button>
          <Button
            type="button"
            disabled={isLast}
            onClick={() =>
              setIndex((i) => Math.min(questions.length - 1, i + 1))
            }
          >
            Next
            <ArrowRight />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
