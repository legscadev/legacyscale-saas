'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  RotateCcw,
  Target,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  setLessonCompleteAction,
  submitQuizAttemptAction,
} from '@/app/(user)/courses/[slug]/lessons/[lessonId]/actions'

interface QuizQuestion {
  id: string
  questionText: string
  options: unknown // Prisma Json — narrowed below to string[]
  orderIndex: number
}

interface QuizRunnerProps {
  lessonId: string
  title: string
  description: string | null
  questions: QuizQuestion[]
  passingScore: number | null
  maxAttempts: number | null
  timeLimitMin: number | null
  /** When provided, Skip quiz marks complete + navigates here. Omit
   *  on the last lesson of a course. Try again intentionally stays
   *  on this lesson regardless. */
  nextHref?: string
}

interface QuizResult {
  passed: boolean
  score: number
  total: number
  passingScore: number
  breakdown: Array<{
    questionId: string
    selected: number | null
    correctIndex: number
    explanation: string | null
  }>
}

type Phase = 'intro' | 'active' | 'result'

function optionList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  return []
}

export function QuizRunner({
  lessonId,
  title,
  description,
  questions,
  passingScore,
  maxAttempts,
  timeLimitMin,
  nextHref,
}: QuizRunnerProps) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('intro')
  const [navigating, setNavigating] = useState(false)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [attempt, setAttempt] = useState(1)
  const [result, setResult] = useState<QuizResult | null>(null)
  const [isPending, startTransition] = useTransition()

  // Per spec 5.5: Try Again + Skip Quiz both mark the lesson complete
  // regardless of score. Fire-and-forget — the action is idempotent
  // and the user shouldn't wait on it.
  const markCompleteBackground = () => {
    void setLessonCompleteAction(lessonId, true)
  }

  const restart = () => {
    markCompleteBackground()
    setAnswers({})
    setIndex(0)
    setResult(null)
    setAttempt((a) => a + 1)
    setPhase('active')
  }

  // Skip Quiz from intro (pre-quiz bail) OR result (post-quiz dismiss).
  // Marks complete and, when a next lesson exists, navigates there
  // with the same "Moving to next lesson…" cue as MarkCompleteButton.
  // On the last lesson of a course (no nextHref) we instead drop the
  // runner back to its intro card so the member is left in a clean
  // state — they can still restart the quiz from there.
  const skipQuiz = () => {
    markCompleteBackground()
    if (nextHref) {
      setNavigating(true)
      toast.success('Quiz skipped — moving to next lesson')
      router.push(nextHref)
      return
    }
    setAnswers({})
    setIndex(0)
    setResult(null)
    setAttempt((a) => a + 1)
    setPhase('intro')
    toast.success('Quiz skipped — lesson marked complete')
  }

  const submit = () => {
    startTransition(async () => {
      const res = await submitQuizAttemptAction(lessonId, answers)
      if (!res.ok) {
        toast.error(res.error ?? 'Could not submit quiz')
        return
      }
      setResult({
        passed: res.passed!,
        score: res.score!,
        total: res.total!,
        passingScore: res.passingScore!,
        breakdown: res.breakdown!,
      })
      setPhase('result')
      if (res.passed) {
        toast.success('Quiz passed — lesson marked complete')
      } else {
        toast.error('Not quite — try again')
      }
    })
  }

  if (questions.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">
          This quiz doesn&apos;t have any questions yet.
        </p>
      </Card>
    )
  }

  if (phase === 'intro') {
    return (
      <Card className="gap-5 p-6">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <Info
            icon={Target}
            label="Pass mark"
            value={`${passingScore ?? 70}%`}
          />
          <Info
            icon={RotateCcw}
            label="Attempts"
            value={maxAttempts ? `${maxAttempts} max` : 'Unlimited'}
          />
          <Info
            icon={Clock}
            label="Time limit"
            value={timeLimitMin ? `${timeLimitMin} min` : 'None'}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setPhase('active')}
            disabled={navigating}
          >
            Start quiz
            <ChevronRight />
          </Button>
          <Button
            variant="ghost"
            onClick={skipQuiz}
            disabled={navigating}
            aria-live="polite"
          >
            {navigating ? (
              <ArrowRight className="animate-pulse" />
            ) : null}
            {navigating ? 'Moving to next lesson…' : 'Skip quiz'}
          </Button>
        </div>
      </Card>
    )
  }

  if (phase === 'result' && result) {
    return (
      <div className="space-y-4">
        <Card
          className={cn(
            'gap-2 p-6 ring-1',
            result.passed
              ? 'ring-success/30 bg-success/[0.03]'
              : 'ring-error/30 bg-error/[0.03]',
          )}
        >
          <div className="flex items-center gap-3">
            {result.passed ? (
              <CheckCircle2 className="size-8 text-success" />
            ) : (
              <XCircle className="size-8 text-error" />
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold">
                {result.passed ? 'Passed!' : 'Not quite'}
              </h2>
              <p className="text-sm text-muted-foreground">
                You scored {result.score}/{result.total} (
                {Math.round((result.score / result.total) * 100)}%) · attempt{' '}
                {attempt}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" onClick={restart} disabled={navigating}>
                <RotateCcw />
                Try again
              </Button>
              <Button
                variant="ghost"
                onClick={skipQuiz}
                disabled={navigating}
                aria-live="polite"
              >
                {navigating ? (
                  <ArrowRight className="animate-pulse" />
                ) : null}
                {navigating ? 'Moving to next lesson…' : 'Skip quiz'}
              </Button>
            </div>
          </div>
        </Card>

        {questions.map((q, i) => {
          const item = result.breakdown.find((b) => b.questionId === q.id)
          return (
            <QuestionReview
              key={q.id}
              index={i}
              question={q}
              chosen={item?.selected ?? null}
              correctIndex={item?.correctIndex ?? 0}
              explanation={item?.explanation ?? null}
            />
          )
        })}
      </div>
    )
  }

  const q = questions[index]!
  const chosen = answers[q.id]
  const isLast = index === questions.length - 1
  const options = optionList(q.options)

  return (
    <Card className="gap-5 p-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Question {index + 1} of {questions.length}
          </span>
          <span className="truncate">{title}</span>
        </div>
        <Progress value={((index + 1) / questions.length) * 100} />
      </div>

      <h2 className="text-lg font-medium">{q.questionText}</h2>

      <div className="space-y-2">
        {options.map((opt, oi) => (
          <button
            key={oi}
            type="button"
            onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left text-sm transition-colors',
              chosen === oi
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'hover:bg-muted/60',
            )}
          >
            <span
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-full border text-xs font-medium',
                chosen === oi
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'text-muted-foreground',
              )}
            >
              {String.fromCharCode(65 + oi)}
            </span>
            {opt}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => setIndex((i) => i - 1)}
          disabled={index === 0 || isPending}
        >
          <ChevronLeft />
          Previous
        </Button>
        {isLast ? (
          <Button
            onClick={submit}
            disabled={chosen === undefined || isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="animate-spin" />
                Submitting…
              </>
            ) : (
              'Submit quiz'
            )}
          </Button>
        ) : (
          <Button
            onClick={() => setIndex((i) => i + 1)}
            disabled={chosen === undefined}
          >
            Next
            <ChevronRight />
          </Button>
        )}
      </div>
    </Card>
  )
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border p-3">
      <Icon className="size-4 text-muted-foreground" />
      <p className="mt-2 font-medium">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function QuestionReview({
  index,
  question,
  chosen,
  correctIndex,
  explanation,
}: {
  index: number
  question: QuizQuestion
  chosen: number | null
  correctIndex: number
  explanation: string | null
}) {
  const correct = chosen === correctIndex
  const options = optionList(question.options)
  return (
    <Card className="gap-3 p-5">
      <div className="flex items-start gap-2">
        {correct ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
        ) : (
          <XCircle className="mt-0.5 size-4 shrink-0 text-error" />
        )}
        <p className="text-sm font-medium">
          {index + 1}. {question.questionText}
        </p>
      </div>
      <div className="space-y-1.5 pl-6">
        {options.map((opt, oi) => {
          const isCorrect = oi === correctIndex
          const isChosen = oi === chosen
          return (
            <div
              key={oi}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-sm',
                isCorrect && 'bg-success/10 text-success',
                isChosen && !isCorrect && 'bg-error/10 text-error',
                !isCorrect && !isChosen && 'text-muted-foreground',
              )}
            >
              {opt}
              {isChosen ? ' · your answer' : ''}
            </div>
          )
        })}
      </div>
      {explanation ? (
        <p className="ml-6 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          {explanation}
        </p>
      ) : null}
    </Card>
  )
}
