'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  createQuestionSchema,
  type CreateQuestionInput,
} from '@/lib/validations/quiz'
import type { QuizQuestionItem } from '@/lib/services/quiz-service'

type FieldErrors = Partial<Record<string, string[]>>

interface QuizQuestionFormProps {
  /** Optional initial question for the edit flow. Phase B uses this. */
  initial?: QuizQuestionItem
  /** Defaulted by the parent: which Add button opened the form. */
  defaultType?: 'MULTIPLE_CHOICE' | 'TRUE_FALSE'
  submitting?: boolean
  /** Server-returned field errors to render under the right inputs. */
  serverErrors?: FieldErrors
  onCancel: () => void
  onSubmit: (input: CreateQuestionInput) => void
}

const MC_DEFAULT_OPTIONS = ['', '', '', '']

export function QuizQuestionForm({
  initial,
  defaultType,
  submitting,
  serverErrors,
  onCancel,
  onSubmit,
}: QuizQuestionFormProps) {
  const initialType = initial?.type ?? defaultType ?? 'MULTIPLE_CHOICE'
  const [type, setType] = useState<'MULTIPLE_CHOICE' | 'TRUE_FALSE'>(initialType)
  const [questionText, setQuestionText] = useState(initial?.questionText ?? '')
  const [explanation, setExplanation] = useState(initial?.explanation ?? '')
  // Options shape depends on type. For MC the user edits the strings;
  // for TF the strings are fixed to ['True', 'False'] and only the
  // correct index changes.
  const [mcOptions, setMcOptions] = useState<string[]>(
    initial?.type === 'MULTIPLE_CHOICE'
      ? (initial.options as string[])
      : MC_DEFAULT_OPTIONS,
  )
  const [correctIndex, setCorrectIndex] = useState<number>(
    initial?.correctIndex ?? 0,
  )

  const [localErrors, setLocalErrors] = useState<FieldErrors>({})

  const errors: FieldErrors = { ...serverErrors, ...localErrors }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLocalErrors({})

    const payload: CreateQuestionInput =
      type === 'TRUE_FALSE'
        ? {
            type: 'TRUE_FALSE',
            questionText: questionText.trim(),
            options: ['True', 'False'],
            correctIndex: correctIndex === 1 ? 1 : 0,
            explanation: explanation.trim() || null,
          }
        : {
            type: 'MULTIPLE_CHOICE',
            questionText: questionText.trim(),
            options: mcOptions.map((o) => o.trim()).filter((o) => o.length > 0),
            correctIndex,
            explanation: explanation.trim() || null,
          }

    const parsed = createQuestionSchema.safeParse(payload)
    if (!parsed.success) {
      const next: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.') || '_'
        if (!next[key]) next[key] = []
        next[key]!.push(issue.message)
      }
      setLocalErrors(next)
      return
    }
    onSubmit(parsed.data)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border bg-background p-4"
    >
      {/* Type switcher — only visible when adding (initial swap is rare on edit) */}
      {!initial ? (
        <div className="flex gap-1.5 text-xs">
          <TypePill
            active={type === 'MULTIPLE_CHOICE'}
            onClick={() => setType('MULTIPLE_CHOICE')}
            label="Multiple choice"
          />
          <TypePill
            active={type === 'TRUE_FALSE'}
            onClick={() => setType('TRUE_FALSE')}
            label="True / False"
          />
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="question-text">Question</Label>
        <Textarea
          id="question-text"
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          placeholder="What's the question?"
          rows={2}
          aria-invalid={!!errors.questionText}
        />
        {errors.questionText?.[0] ? (
          <p className="text-xs text-destructive" role="alert">
            {errors.questionText[0]}
          </p>
        ) : null}
      </div>

      {type === 'MULTIPLE_CHOICE' ? (
        <McOptionsEditor
          options={mcOptions}
          correctIndex={correctIndex}
          errors={errors}
          onOptionsChange={setMcOptions}
          onCorrectChange={setCorrectIndex}
        />
      ) : (
        <TfOptionsEditor
          correctIndex={correctIndex}
          onChange={setCorrectIndex}
        />
      )}

      <div className="space-y-1.5">
        <Label htmlFor="question-explanation">
          Explanation <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="question-explanation"
          value={explanation ?? ''}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder="Shown to members after they answer."
          rows={2}
        />
      </div>

      {errors._?.[0] ? (
        <p className="text-xs text-destructive" role="alert">
          {errors._[0]}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : initial ? 'Save question' : 'Add question'}
        </Button>
      </div>
    </form>
  )
}

function TypePill({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1 font-medium transition-colors',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted',
      )}
    >
      {label}
    </button>
  )
}

interface McOptionsEditorProps {
  options: string[]
  correctIndex: number
  errors: FieldErrors
  onOptionsChange: (next: string[]) => void
  onCorrectChange: (i: number) => void
}

function McOptionsEditor({
  options,
  correctIndex,
  errors,
  onOptionsChange,
  onCorrectChange,
}: McOptionsEditorProps) {
  const canRemove = options.length > 2
  const canAdd = options.length < 6

  return (
    <div className="space-y-2">
      <Label>Options · click the radio for the correct answer</Label>
      <ul className="space-y-1.5">
        {options.map((value, i) => (
          <li key={i} className="flex items-center gap-2">
            <input
              type="radio"
              name="mc-correct"
              checked={correctIndex === i}
              onChange={() => onCorrectChange(i)}
              className="size-4 accent-primary"
              aria-label={`Mark option ${i + 1} as correct`}
            />
            <Input
              value={value}
              onChange={(e) => {
                const next = [...options]
                next[i] = e.target.value
                onOptionsChange(next)
              }}
              placeholder={`Option ${i + 1}`}
              aria-invalid={!!errors[`options.${i}`]}
            />
            {canRemove ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove option ${i + 1}`}
                onClick={() => {
                  const next = options.filter((_, idx) => idx !== i)
                  onOptionsChange(next)
                  // Re-point correctIndex if we just removed it (or
                  // anything before it).
                  if (correctIndex === i) onCorrectChange(0)
                  else if (correctIndex > i) onCorrectChange(correctIndex - 1)
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {errors.correctIndex?.[0] ? (
        <p className="text-xs text-destructive" role="alert">
          {errors.correctIndex[0]}
        </p>
      ) : null}
      {errors.options?.[0] ? (
        <p className="text-xs text-destructive" role="alert">
          {errors.options[0]}
        </p>
      ) : null}
      {canAdd ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onOptionsChange([...options, ''])}
        >
          <Plus className="size-3.5" />
          Add option
        </Button>
      ) : null}
    </div>
  )
}

function TfOptionsEditor({
  correctIndex,
  onChange,
}: {
  correctIndex: number
  onChange: (i: number) => void
}) {
  return (
    <div className="space-y-2">
      <Label>Correct answer</Label>
      <div className="flex gap-1.5">
        <TypePill
          active={correctIndex === 0}
          onClick={() => onChange(0)}
          label="True"
        />
        <TypePill
          active={correctIndex === 1}
          onClick={() => onChange(1)}
          label="False"
        />
      </div>
    </div>
  )
}
