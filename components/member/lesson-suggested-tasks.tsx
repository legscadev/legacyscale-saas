'use client'

// Student-facing "Suggested tasks" panel on the lesson viewer.
// One-click adds a task template into the student's personal
// Tasks & Goals list, optionally with a due date, linked back to
// this lesson + course so it opens the lesson from /tasks.

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { CalendarDays, CheckCircle2, ListChecks, Plus, X } from 'lucide-react'
import { toast } from 'sonner'

import { addSuggestionToTasksAction } from '@/app/(user)/tasks/actions'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { LessonTaskSuggestionRow } from '@/lib/services/lesson-task-suggestion-service'

interface Props {
  suggestions: LessonTaskSuggestionRow[]
}

export function LessonSuggestedTasks({ suggestions }: Props) {
  if (suggestions.length === 0) return null
  return (
    <Card className="gap-3 p-4">
      <header className="flex items-center gap-2">
        <ListChecks className="size-4 text-primary" aria-hidden />
        <h3 className="text-sm font-semibold">Suggested tasks</h3>
        <span className="ml-1 text-xs text-muted-foreground">
          Add these to your personal{' '}
          <Link
            href="/tasks"
            className="font-medium text-primary hover:underline"
          >
            Tasks &amp; Goals
          </Link>
        </span>
      </header>
      <ul className="space-y-2">
        {suggestions.map((s) => (
          <li key={s.id}>
            <SuggestionRow suggestion={s} />
          </li>
        ))}
      </ul>
    </Card>
  )
}

function SuggestionRow({ suggestion }: { suggestion: LessonTaskSuggestionRow }) {
  const [dueOpen, setDueOpen] = useState(false)
  const [dueDate, setDueDate] = useState('')
  const [added, setAdded] = useState(false)
  const [pending, startTransition] = useTransition()

  function submit(withDueDate: string | undefined) {
    startTransition(async () => {
      const res = await addSuggestionToTasksAction({
        suggestionId: suggestion.id,
        dueDate: withDueDate,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not add task')
        return
      }
      setAdded(true)
      setDueOpen(false)
      toast.success('Added to your tasks')
    })
  }

  return (
    <div
      className={cn(
        'rounded-md border bg-card p-3',
        added && 'border-emerald-500/40 bg-emerald-500/5',
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">{suggestion.title}</p>
          {suggestion.description ? (
            <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted-foreground">
              {suggestion.description}
            </p>
          ) : null}
        </div>
        {added ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
            <CheckCircle2 className="size-3" /> Added
          </span>
        ) : dueOpen ? null : (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDueOpen(true)}
              disabled={pending}
            >
              <CalendarDays className="size-3.5" />
              Set due
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => submit(undefined)}
              disabled={pending}
            >
              <Plus className="size-3.5" />
              Add
            </Button>
          </div>
        )}
      </div>
      {dueOpen && !added ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 p-2">
          <label className="flex items-center gap-1.5 text-xs">
            <CalendarDays className="size-3.5 text-muted-foreground" />
            Due
            <Input
              type="date"
              autoFocus
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-8 w-40"
              disabled={pending}
            />
          </label>
          <div className="ml-auto flex gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setDueOpen(false)
                setDueDate('')
              }}
              disabled={pending}
            >
              <X className="size-3.5" />
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => submit(dueDate || undefined)}
              disabled={pending}
            >
              Add with date
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
