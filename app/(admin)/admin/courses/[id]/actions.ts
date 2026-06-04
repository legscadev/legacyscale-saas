'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

import { requireAdmin } from '@/lib/auth/get-user'
import {
  chapterService,
  type ChapterListItem,
} from '@/lib/services/chapter-service'
import {
  createChapterSchema,
  updateChapterSchema,
} from '@/lib/validations/course'

interface BaseResult {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

export interface CreateChapterResult extends BaseResult {
  chapter?: ChapterListItem
}

export interface UpdateChapterResult extends BaseResult {
  chapter?: ChapterListItem
}

const reorderSchema = z.object({
  courseId: z.uuid(),
  orderedIds: z.array(z.uuid()).min(1),
})

function fieldErrorsFrom(error: z.ZodError) {
  const result: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.')
    if (!result[key]) result[key] = []
    result[key]!.push(issue.message)
  }
  return result
}

// ===========================================================
// CREATE
// ===========================================================

export async function createChapterAction(
  courseId: string,
  title = 'New chapter',
): Promise<CreateChapterResult> {
  await requireAdmin()

  const parsed = createChapterSchema.safeParse({ courseId, title })
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) }
  }

  try {
    const chapter = await chapterService.create(parsed.data)
    revalidatePath(`/admin/courses/${courseId}`)
    return { ok: true, chapter }
  } catch (err) {
    console.error('Chapter create failed:', err)
    return { ok: false, error: 'Could not create chapter' }
  }
}

// ===========================================================
// UPDATE  (rename)
// ===========================================================

export async function updateChapterAction(
  chapterId: string,
  input: { title?: string; orderIndex?: number },
): Promise<UpdateChapterResult> {
  await requireAdmin()

  const parsed = updateChapterSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) }
  }

  try {
    const chapter = await chapterService.update(chapterId, parsed.data)
    revalidatePath(`/admin/courses/${chapter.courseId}`)
    return { ok: true, chapter }
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      return { ok: false, error: 'Chapter not found' }
    }
    console.error('Chapter update failed:', err)
    return { ok: false, error: 'Could not save chapter' }
  }
}

// ===========================================================
// DELETE
// ===========================================================

export async function deleteChapterAction(
  chapterId: string,
  courseId: string,
): Promise<BaseResult> {
  await requireAdmin()
  try {
    await chapterService.delete(chapterId)
    revalidatePath(`/admin/courses/${courseId}`)
    return { ok: true }
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      return { ok: false, error: 'Chapter not found' }
    }
    console.error('Chapter delete failed:', err)
    return { ok: false, error: 'Could not delete chapter' }
  }
}

// ===========================================================
// REORDER
// ===========================================================

export async function reorderChaptersAction(
  courseId: string,
  orderedIds: string[],
): Promise<BaseResult> {
  await requireAdmin()

  const parsed = reorderSchema.safeParse({ courseId, orderedIds })
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) }
  }

  try {
    await chapterService.reorder(parsed.data.courseId, parsed.data.orderedIds)
    revalidatePath(`/admin/courses/${courseId}`)
    return { ok: true }
  } catch (err) {
    console.error('Chapter reorder failed:', err)
    return { ok: false, error: 'Could not reorder chapters' }
  }
}
