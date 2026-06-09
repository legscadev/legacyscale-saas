"use client"

import { useState } from "react"
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  RotateCcw,
  Target,
  XCircle,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { Lesson, QuizQuestion } from "@/lib/prototype"

type Phase = "intro" | "active" | "result"

export function QuizRunner({ lesson }: { lesson: Lesson }) {
  const questions = lesson.questions ?? []
  const [phase, setPhase] = useState<Phase>("intro")
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [attempt, setAttempt] = useState(1)

  const score = questions.filter((q) => answers[q.id] === q.correctIndex).length
  const pct = questions.length ? Math.round((score / questions.length) * 100) : 0
  const passed = pct >= (lesson.passingScore ?? 0)

  const restart = () => {
    setAnswers({})
    setIndex(0)
    setAttempt((a) => a + 1)
    setPhase("active")
  }

  if (phase === "intro") {
    return (
      <Card className="gap-5 p-6">
        <div>
          <h2 className="text-lg font-semibold">{lesson.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {lesson.description}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <Info icon={Target} label="Pass mark" value={`${lesson.passingScore}%`} />
          <Info
            icon={RotateCcw}
            label="Attempts"
            value={lesson.maxAttempts ? `${lesson.maxAttempts} max` : "Unlimited"}
          />
          <Info
            icon={Clock}
            label="Time limit"
            value={lesson.timeLimitMin ? `${lesson.timeLimitMin} min` : "None"}
          />
        </div>
        <Button className="w-fit" onClick={() => setPhase("active")}>
          Start quiz
          <ChevronRight />
        </Button>
      </Card>
    )
  }

  if (phase === "result") {
    return (
      <div className="space-y-4">
        <Card
          className={cn(
            "gap-2 p-6",
            passed ? "ring-success/30" : "ring-error/30"
          )}
        >
          <div className="flex items-center gap-3">
            {passed ? (
              <CheckCircle2 className="size-8 text-success" />
            ) : (
              <XCircle className="size-8 text-error" />
            )}
            <div>
              <h2 className="text-lg font-semibold">
                {passed ? "Passed!" : "Not quite"}
              </h2>
              <p className="text-sm text-muted-foreground">
                You scored {score}/{questions.length} ({pct}%) · attempt {attempt}
              </p>
            </div>
            <Button variant="outline" className="ml-auto" onClick={restart}>
              <RotateCcw />
              Retake
            </Button>
          </div>
        </Card>

        {questions.map((q, i) => (
          <QuestionReview key={q.id} index={i} question={q} chosen={answers[q.id]} />
        ))}
      </div>
    )
  }

  const q = questions[index]
  const chosen = answers[q.id]
  const isLast = index === questions.length - 1

  return (
    <Card className="gap-5 p-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Question {index + 1} of {questions.length}
          </span>
          <span>{lesson.title}</span>
        </div>
        <Progress value={((index + 1) / questions.length) * 100} />
      </div>

      <h2 className="text-lg font-medium">{q.questionText}</h2>

      <div className="space-y-2">
        {q.options.map((opt, oi) => (
          <button
            key={oi}
            onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left text-sm transition-colors",
              chosen === oi
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "hover:bg-muted/60"
            )}
          >
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                chosen === oi
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground"
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
          disabled={index === 0}
        >
          <ChevronLeft />
          Previous
        </Button>
        {isLast ? (
          <Button
            onClick={() => setPhase("result")}
            disabled={chosen === undefined}
          >
            Submit quiz
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
  icon: typeof Target
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
}: {
  index: number
  question: QuizQuestion
  chosen?: number
}) {
  const correct = chosen === question.correctIndex
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
        {question.options.map((opt, oi) => {
          const isCorrect = oi === question.correctIndex
          const isChosen = oi === chosen
          return (
            <div
              key={oi}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-sm",
                isCorrect && "bg-success/10 text-success",
                isChosen && !isCorrect && "bg-error/10 text-error",
                !isCorrect && !isChosen && "text-muted-foreground"
              )}
            >
              {opt}
              {isChosen ? " · your answer" : ""}
            </div>
          )
        })}
      </div>
      {question.explanation ? (
        <p className="ml-6 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          {question.explanation}
        </p>
      ) : null}
    </Card>
  )
}
