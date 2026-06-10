/**
 * Sequential unlock model: a lesson is unlocked iff every preceding
 * READY lesson is complete, OR it has been completed before (so a
 * later unmark of an earlier lesson doesn't surprise the user by
 * re-locking lessons they've already passed through).
 *
 * Non-READY lessons (PROCESSING / DRAFT) are transparent — they
 * stay locked-by-status but don't gate subsequent READY lessons,
 * so a stuck processing job can't soft-lock the rest of the course.
 *
 * `lessons` must already be in curriculum order (chapters by
 * orderIndex, lessons by orderIndex within each chapter, flattened).
 */
interface GatableLesson {
  id: string
  status: 'DRAFT' | 'PROCESSING' | 'READY'
  progress: { completed: boolean } | null
}

interface LessonGating {
  unlockedIds: Set<string>
  /** First incomplete READY lesson — where a deep-link redirect should land. */
  frontierId: string | null
}

export function computeLessonGating<T extends GatableLesson>(
  lessons: T[],
): LessonGating {
  const unlockedIds = new Set<string>()
  let frontierId: string | null = null
  let allPriorComplete = true

  for (const lesson of lessons) {
    if (lesson.status !== 'READY') continue
    const isCompleted = lesson.progress?.completed ?? false

    if (allPriorComplete) {
      unlockedIds.add(lesson.id)
      if (!isCompleted) {
        if (frontierId === null) frontierId = lesson.id
        allPriorComplete = false
      }
    } else if (isCompleted) {
      // Previously completed lessons stay accessible even if an
      // earlier lesson gets unmarked.
      unlockedIds.add(lesson.id)
    }
  }

  // Everything is complete — keep `frontierId` pointing at a real
  // lesson so the deep-link redirect always has somewhere to go.
  if (frontierId === null) {
    const ready = lessons.filter((l) => l.status === 'READY')
    frontierId = ready[0]?.id ?? null
  }

  return { unlockedIds, frontierId }
}
