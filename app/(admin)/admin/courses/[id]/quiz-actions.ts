'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { z } from 'zod'

import { requireAdmin } from '@/lib/auth/get-user'
import { PROGRESS_TAG } from '@/lib/services/admin-progress-service'
import { quizService, type QuizQuestionItem } from '@/lib/services/quiz-service'
import {
  createQuestionSchema,
  reorderQuestionsSchema,
  updateQuestionSchema,
  type CreateQuestionInput,
  type UpdateQuestionInput,
} from '@/lib/validations/quiz'

// UpdateQuestionInput is currently identical to CreateQuestionInput
// (see validations/quiz.ts) — the form always submits a full payload.

// ===========================================================
// Shared types
// ===========================================================

interface BaseResult {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

export interface ListQuestionsResult extends BaseResult {
  items?: QuizQuestionItem[]
}

export interface QuestionResult extends BaseResult {
  question?: QuizQuestionItem
}

function fieldErrorsFrom(error: z.ZodError) {
  const result: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_'
    if (!result[key]) result[key] = []
    result[key]!.push(issue.message)
  }
  return result
}

// ===========================================================
// LIST
// ===========================================================

export async function listQuizQuestionsAction(
  lessonId: string,
): Promise<ListQuestionsResult> {
  await requireAdmin()
  try {
    const items = await quizService.list(lessonId)
    return { ok: true, items }
  } catch (err) {
    console.error('Quiz question list failed:', err)
    return { ok: false, error: 'Could not load questions' }
  }
}

// ===========================================================
// CREATE
// ===========================================================

export async function createQuizQuestionAction(
  courseId: string,
  lessonId: string,
  input: CreateQuestionInput,
): Promise<QuestionResult> {
  await requireAdmin()

  const parsed = createQuestionSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) }
  }

  try {
    const question = await quizService.create({
      lessonId,
      questionText: parsed.data.questionText,
      type: parsed.data.type,
      // Tuple from the TF schema satisfies string[] at runtime.
      options: [...parsed.data.options],
      correctIndex: parsed.data.correctIndex,
      explanation: parsed.data.explanation ?? null,
    })
    revalidatePath(`/admin/courses/${courseId}`)
    updateTag(PROGRESS_TAG)
    return { ok: true, question }
  } catch (err) {
    console.error('Quiz question create failed:', err)
    return { ok: false, error: 'Could not add question' }
  }
}

// ===========================================================
// UPDATE
// ===========================================================

export async function updateQuizQuestionAction(
  courseId: string,
  questionId: string,
  input: UpdateQuestionInput,
): Promise<QuestionResult> {
  await requireAdmin()

  const parsed = updateQuestionSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) }
  }

  try {
    const question = await quizService.update(questionId, {
      questionText: parsed.data.questionText,
      type: parsed.data.type,
      options: [...parsed.data.options],
      correctIndex: parsed.data.correctIndex,
      explanation: parsed.data.explanation ?? null,
    })
    revalidatePath(`/admin/courses/${courseId}`)
    updateTag(PROGRESS_TAG)
    return { ok: true, question }
  } catch (err) {
    console.error('Quiz question update failed:', err)
    return { ok: false, error: 'Could not save question' }
  }
}

// ===========================================================
// DELETE
// ===========================================================

export async function deleteQuizQuestionAction(
  courseId: string,
  questionId: string,
): Promise<BaseResult> {
  await requireAdmin()
  try {
    await quizService.delete(questionId)
    revalidatePath(`/admin/courses/${courseId}`)
    updateTag(PROGRESS_TAG)
    return { ok: true }
  } catch (err) {
    console.error('Quiz question delete failed:', err)
    return { ok: false, error: 'Could not delete question' }
  }
}

// ===========================================================
// REORDER  (Phase C — wired now so callers can land before the UI)
// ===========================================================

export async function reorderQuizQuestionsAction(
  courseId: string,
  lessonId: string,
  orderedIds: string[],
): Promise<BaseResult> {
  await requireAdmin()

  const parsed = reorderQuestionsSchema.safeParse({ orderedIds })
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) }
  }

  try {
    await quizService.reorder(lessonId, parsed.data.orderedIds)
    revalidatePath(`/admin/courses/${courseId}`)
    updateTag(PROGRESS_TAG)
    return { ok: true }
  } catch (err) {
    console.error('Quiz question reorder failed:', err)
    return { ok: false, error: 'Could not reorder questions' }
  }
}
