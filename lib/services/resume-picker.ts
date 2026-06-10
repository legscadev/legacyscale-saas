interface ResumeLesson {
  id: string
  progress: {
    completed: boolean
    updatedAt: Date
  } | null
}

/**
 * Pick the lesson a returning user should land on when they click
 * "Continue learning."
 *
 * Priority:
 *  1. The most recently touched lesson that is still incomplete (true
 *     "where you left off").
 *  2. If the most-recent activity was a completion, the next incomplete
 *     lesson in curriculum order — searching forward from that lesson
 *     first, then wrapping back to the start so a user who skipped
 *     ahead still gets surfaced an earlier gap.
 *  3. If there's no progress history at all, the very first lesson.
 *  4. If everything is complete, replay from the first lesson.
 *
 * `lessons` is expected to be in curriculum order (chapters by
 * orderIndex, lessons by orderIndex within each chapter, flattened).
 */
export function pickResumeLesson<T extends ResumeLesson>(
  lessons: T[],
): T | null {
  if (lessons.length === 0) return null

  const mostRecent = lessons
    .filter((l) => l.progress?.updatedAt)
    .sort(
      (a, b) =>
        b.progress!.updatedAt.getTime() - a.progress!.updatedAt.getTime(),
    )[0]

  if (!mostRecent) return lessons[0]!
  if (!mostRecent.progress?.completed) return mostRecent

  const startIdx = lessons.findIndex((l) => l.id === mostRecent.id) + 1
  for (let i = startIdx; i < lessons.length; i++) {
    if (!lessons[i]!.progress?.completed) return lessons[i]!
  }
  for (let i = 0; i < startIdx; i++) {
    if (!lessons[i]!.progress?.completed) return lessons[i]!
  }
  return lessons[0]!
}
