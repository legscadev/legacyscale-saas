import { prisma } from '@/lib/prisma'

export interface NoteView {
  content: string
  updatedAt: Date | null
}

/**
 * Load the note a user has written for a lesson. Returns an "empty"
 * shape when no row exists yet so the client doesn't have to branch
 * on first-write vs subsequent updates.
 */
export async function getNote(
  userId: string,
  lessonId: string,
): Promise<NoteView> {
  const note = await prisma.note.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
    select: { content: true, updatedAt: true },
  })
  return note ?? { content: '', updatedAt: null }
}

/**
 * Persist a note. Uses the `(userId, lessonId)` unique constraint as
 * the upsert key so concurrent saves resolve to a single row (last
 * write wins).
 */
export async function upsertNote(
  userId: string,
  lessonId: string,
  content: string,
): Promise<NoteView> {
  const row = await prisma.note.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    update: { content },
    create: { userId, lessonId, content },
    select: { content: true, updatedAt: true },
  })
  return row
}
