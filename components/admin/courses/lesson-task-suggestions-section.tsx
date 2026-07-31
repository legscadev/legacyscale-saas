'use client'

// Admin section inside LessonEditorDialog for managing the
// instructor's "suggested tasks" attached to a lesson. Students
// see the same list on the lesson viewer and one-click add them
// to their personal /tasks list.
//
// Follows the same "call ensureSaved() before first write"
// pattern the resource / video sections use so an unsaved lesson
// (still a tempId) auto-saves before we insert its first
// suggestion.

import { useEffect, useState, useTransition } from 'react'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  createLessonTaskSuggestionAction,
  deleteLessonTaskSuggestionAction,
  fetchLessonTaskSuggestionsAction,
  updateLessonTaskSuggestionAction,
} from '@/app/(admin)/admin/courses/[slug]/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { LessonTaskSuggestionRow } from '@/lib/services/lesson-task-suggestion-service'

interface Props {
  lessonId: string
  ensureSaved: () => Promise<
    { ok: true; lessonId: string } | { ok: false; error?: string }
  >
}

export function LessonTaskSuggestionsSection({ lessonId, ensureSaved }: Props) {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<LessonTaskSuggestionRow[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Fetch existing suggestions when the section mounts. `lessonId`
  // may be a tempId until first save; the fetch tolerates that
  // (returns []).
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchLessonTaskSuggestionsAction(lessonId).then((res) => {
      if (cancelled) return
      setLoading(false)
      if (!res.ok) {
        toast.error(res.error ?? 'Could not load suggested tasks')
        return
      }
      setItems(res.data)
    })
    return () => {
      cancelled = true
    }
  }, [lessonId])

  async function handleCreate(title: string, description: string) {
    // Auto-save the lesson (tempId → real id) before the first
    // suggestion so the FK has something valid to point at.
    const saved = await ensureSaved()
    if (!saved.ok) {
      toast.error(saved.error ?? 'Could not save lesson')
      return
    }
    startTransition(async () => {
      const res = await createLessonTaskSuggestionAction({
        lessonId: saved.lessonId,
        title,
        description: description || null,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not add suggested task')
        return
      }
      setItems((prev) => [...prev, res.data])
      setAddOpen(false)
    })
  }

  function handleUpdate(
    suggestionId: string,
    title: string,
    description: string,
  ) {
    startTransition(async () => {
      const res = await updateLessonTaskSuggestionAction({
        suggestionId,
        title,
        description: description || null,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not update suggested task')
        return
      }
      setItems((prev) =>
        prev.map((s) => (s.id === suggestionId ? res.data : s)),
      )
      setEditing(null)
    })
  }

  function handleDelete(suggestionId: string) {
    startTransition(async () => {
      const res = await deleteLessonTaskSuggestionAction({ suggestionId })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not delete suggested task')
        return
      }
      setItems((prev) => prev.filter((s) => s.id !== suggestionId))
    })
  }

  return (
    <section className="space-y-3 border-t pt-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          Suggested tasks
          {items.length > 0 ? (
            <span className="ml-1.5 text-muted-foreground/60">
              · {items.length}
            </span>
          ) : null}
        </Label>
        {addOpen ? null : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setAddOpen(true)}
            disabled={pending}
          >
            <Plus className="size-3.5" />
            Add
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Students can one-click any of these into their personal Tasks &
        Goals list. Edits here don't reshape tasks already claimed.
      </p>

      {addOpen ? (
        <SuggestionForm
          onCancel={() => setAddOpen(false)}
          onSubmit={handleCreate}
          disabled={pending}
        />
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Loading…
        </div>
      ) : items.length === 0 && !addOpen ? (
        <p className="rounded-md border border-dashed bg-muted/10 px-3 py-4 text-center text-xs text-muted-foreground">
          No suggested tasks yet. Add one above to help students act
          on this lesson.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((suggestion) => (
            <li key={suggestion.id}>
              {editing === suggestion.id ? (
                <SuggestionForm
                  initial={suggestion}
                  onCancel={() => setEditing(null)}
                  onSubmit={(title, description) =>
                    handleUpdate(suggestion.id, title, description)
                  }
                  disabled={pending}
                />
              ) : (
                <div className="group flex items-start gap-2 rounded-md border bg-card px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug">
                      {suggestion.title}
                    </p>
                    {suggestion.description ? (
                      <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted-foreground">
                        {suggestion.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => setEditing(suggestion.id)}
                      disabled={pending}
                      aria-label="Edit suggested task"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(suggestion.id)}
                      disabled={pending}
                      aria-label="Delete suggested task"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function SuggestionForm({
  initial,
  onCancel,
  onSubmit,
  disabled,
}: {
  initial?: LessonTaskSuggestionRow
  onCancel: () => void
  onSubmit: (title: string, description: string) => void
  disabled: boolean
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')

  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      <Input
        autoFocus
        placeholder="Task title (e.g. Look up 5 niches, pick 3)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
        disabled={disabled}
      />
      <Textarea
        placeholder="Optional notes / instructions"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        disabled={disabled}
      />
      <div className="flex justify-end gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={disabled}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            if (!title.trim()) {
              toast.error('Title is required')
              return
            }
            onSubmit(title.trim(), description.trim())
          }}
          disabled={disabled}
        >
          {initial ? 'Save' : 'Add task'}
        </Button>
      </div>
    </div>
  )
}
