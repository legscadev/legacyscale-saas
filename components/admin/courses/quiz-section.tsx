'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Eye,
  GraduationCap,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  createQuizQuestionAction,
  deleteQuizQuestionAction,
  listQuizQuestionsAction,
  reorderQuizQuestionsAction,
  updateQuizQuestionAction,
} from '@/app/(admin)/admin/courses/[id]/quiz-actions'
import type { QuizQuestionItem } from '@/lib/services/quiz-service'
import type { CreateQuestionInput } from '@/lib/validations/quiz'

import { QuizQuestionForm } from './quiz-question-form'
import { QuizPreviewDialog } from './quiz-preview-dialog'

interface QuizSectionProps {
  lessonId: string
  courseId: string
  ensureSaved: () => Promise<
    { ok: true; lessonId: string } | { ok: false; error?: string }
  >
}

type AddingType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | null

export function QuizSection({
  lessonId,
  courseId,
  ensureSaved,
}: QuizSectionProps) {
  const [questions, setQuestions] = useState<QuizQuestionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState<AddingType>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Track which question id is being deleted so its row shows a spinner.
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // Fetch the existing questions on mount. We refetch when lessonId
  // changes — that happens after ensureSaved() swaps a tempId for the
  // real uuid.
  useEffect(() => {
    if (lessonId.startsWith('temp-l-')) {
      // Unsaved lesson — no questions exist on the server yet. Skip the
      // fetch and let the user save by hitting "Add question" (which
      // triggers ensureSaved first).
      setQuestions([])
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    void (async () => {
      const result = await listQuizQuestionsAction(lessonId)
      if (controller.signal.aborted) return
      if (result.ok && result.items) {
        setQuestions(result.items)
      } else {
        toast.error(result.error ?? 'Could not load quiz questions')
      }
      setLoading(false)
    })()
    return () => controller.abort()
  }, [lessonId])

  const handleAdd = useCallback(
    async (input: CreateQuestionInput) => {
      setSubmitting(true)
      try {
        const saved = await ensureSaved()
        if (!saved.ok) {
          toast.error(saved.error ?? 'Could not save lesson')
          return
        }
        const result = await createQuizQuestionAction(
          courseId,
          saved.lessonId,
          input,
        )
        if (!result.ok || !result.question) {
          toast.error(result.error ?? 'Could not add question')
          return
        }
        setQuestions((prev) => [...prev, result.question!])
        setAdding(null)
        toast.success('Question added')
      } finally {
        setSubmitting(false)
      }
    },
    [courseId, ensureSaved],
  )

  const handleEdit = useCallback(
    async (questionId: string, input: CreateQuestionInput) => {
      setSubmitting(true)
      try {
        const result = await updateQuizQuestionAction(courseId, questionId, input)
        if (!result.ok || !result.question) {
          toast.error(result.error ?? 'Could not save question')
          return
        }
        setQuestions((prev) =>
          prev.map((q) => (q.id === questionId ? result.question! : q)),
        )
        setEditingId(null)
        toast.success('Question updated')
      } finally {
        setSubmitting(false)
      }
    },
    [courseId],
  )

  const handleDelete = useCallback(
    async (questionId: string) => {
      setDeletingId(questionId)
      const result = await deleteQuizQuestionAction(courseId, questionId)
      if (!result.ok) {
        toast.error(result.error ?? 'Could not delete question')
        setDeletingId(null)
        return
      }
      setQuestions((prev) => prev.filter((q) => q.id !== questionId))
      setDeletingId(null)
      toast.success('Question removed')
    },
    [courseId],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      // Reorder locally first for snappy UX, then sync with the server.
      // On failure, revert.
      const oldIndex = questions.findIndex((q) => q.id === active.id)
      const newIndex = questions.findIndex((q) => q.id === over.id)
      if (oldIndex < 0 || newIndex < 0) return

      const previous = questions
      const next = arrayMove(questions, oldIndex, newIndex)
      setQuestions(next)
      void (async () => {
        const result = await reorderQuizQuestionsAction(
          courseId,
          lessonId,
          next.map((q) => q.id),
        )
        if (!result.ok) {
          toast.error(result.error ?? 'Could not reorder questions')
          setQuestions(previous)
        }
      })()
    },
    [courseId, lessonId, questions],
  )

  const sortableIds = useMemo(() => questions.map((q) => q.id), [questions])

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <GraduationCap className="size-3.5" />
          Quiz questions
          {questions.length > 0 ? (
            <span className="text-muted-foreground/60">
              · {questions.length}
            </span>
          ) : null}
        </div>
        {questions.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye />
            Preview
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Loading questions…
        </div>
      ) : questions.length === 0 && !adding ? (
        <p className="py-2 text-center text-sm text-muted-foreground">
          No questions yet.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortableIds}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-1.5">
              {questions.map((q, i) =>
                editingId === q.id ? (
                  <li key={q.id}>
                    <QuizQuestionForm
                      initial={q}
                      submitting={submitting}
                      onCancel={() => setEditingId(null)}
                      onSubmit={(input) => void handleEdit(q.id, input)}
                    />
                  </li>
                ) : (
                  <li key={q.id}>
                    <SortableQuestionRow
                      index={i + 1}
                      question={q}
                      deleting={deletingId === q.id}
                      onEdit={() => {
                        setAdding(null)
                        setEditingId(q.id)
                      }}
                      onDelete={() => void handleDelete(q.id)}
                    />
                  </li>
                ),
              )}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {adding ? (
        <QuizQuestionForm
          defaultType={adding}
          submitting={submitting}
          onCancel={() => setAdding(null)}
          onSubmit={(input) => void handleAdd(input)}
        />
      ) : (
        <div className="flex flex-col gap-1.5 pt-1 sm:flex-row">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="flex-1 border-dashed"
            onClick={() => setAdding('MULTIPLE_CHOICE')}
          >
            <Plus />
            Add multiple-choice
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="flex-1 border-dashed"
            onClick={() => setAdding('TRUE_FALSE')}
          >
            <Plus />
            Add true / false
          </Button>
        </div>
      )}

      <QuizPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        questions={questions}
      />
    </div>
  )
}

interface SortableQuestionRowProps {
  index: number
  question: QuizQuestionItem
  deleting: boolean
  onEdit: () => void
  onDelete: () => void
}

function SortableQuestionRow({
  index,
  question,
  deleting,
  onEdit,
  onDelete,
}: SortableQuestionRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: question.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  const options = (question.options as string[]) ?? []
  const correct = options[question.correctIndex] ?? '—'
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-md border bg-background p-3',
        isDragging && 'shadow-md',
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-label="Drag question to reorder"
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" />
        </button>
        <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums text-muted-foreground">
          {index}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium">{question.questionText}</p>
          <p className="text-xs text-muted-foreground">
            <TypeBadge type={question.type} />
            <span className="ml-2">
              {options.length} option{options.length === 1 ? '' : 's'} · correct:{' '}
              <span className="font-medium text-foreground">{correct}</span>
            </span>
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Edit question"
          onClick={onEdit}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Delete question"
          disabled={deleting}
          onClick={onDelete}
        >
          {deleting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
        </Button>
      </div>
    </div>
  )
}

function TypeBadge({ type }: { type: QuizQuestionItem['type'] }) {
  return (
    <span
      className={cn(
        'inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider',
        type === 'MULTIPLE_CHOICE'
          ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
      )}
    >
      {type === 'MULTIPLE_CHOICE' ? 'MC' : 'T/F'}
    </span>
  )
}
