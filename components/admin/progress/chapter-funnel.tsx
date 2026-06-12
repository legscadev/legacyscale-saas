import { TrendingDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/shared'
import type { ChapterFunnelResult } from '@/lib/services/admin-progress-service'

/**
 * Per-chapter completion funnel for a cohort. Renders each chapter
 * with a stacked horizontal bar: a translucent fill for "started"
 * and a solid fill for "completed". Side-by-side counts on the right.
 *
 * Designed for the cohort page — the operator scans down the list to
 * spot the chapter where the funnel narrows sharply (the drop-off).
 */
export function ChapterFunnel({ data }: { data: ChapterFunnelResult }) {
  const { cohortSize, chapters } = data

  if (cohortSize === 0) {
    return (
      <EmptyState
        icon={TrendingDown}
        title="No cohort to analyse"
        description="Adjust the filters above so there's at least one enrolled member, then the funnel will fill in."
      />
    )
  }

  if (chapters.length === 0) {
    return (
      <EmptyState
        icon={TrendingDown}
        title="No chapters yet"
        description="Once this course has chapters and lessons, their completion funnel will surface here."
      />
    )
  }

  // Pinpoint the biggest drop-off so it can be subtly highlighted.
  // "Drop" between chapter i and i+1 is `started_i - completed_i+1`
  // (people who reached chapter i but didn't finish chapter i+1). For
  // the first row we use cohortSize → startedCount as the entry drop.
  let biggestDropIdx = -1
  let biggestDrop = 0
  for (let i = 0; i < chapters.length; i++) {
    const prevStarted = i === 0 ? cohortSize : chapters[i - 1]!.startedCount
    const drop = prevStarted - chapters[i]!.completedCount
    if (drop > biggestDrop) {
      biggestDrop = drop
      biggestDropIdx = i
    }
  }

  return (
    <ul className="space-y-3">
      {chapters.map((c, i) => {
        const highlight = i === biggestDropIdx && biggestDrop > 0
        return (
          <li
            key={c.chapterId}
            className={cn(
              'rounded-md px-3 py-2 transition-colors',
              highlight && 'bg-amber-50/60 dark:bg-amber-500/[0.06]',
            )}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-[11px] font-semibold tabular-nums text-muted-foreground">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <div className="min-w-0">
                    {c.moduleTitle ? (
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {c.moduleTitle}
                      </p>
                    ) : null}
                    <p className="truncate text-sm font-medium">
                      {c.chapterTitle}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs tabular-nums text-muted-foreground">
                    <span>
                      <span className="font-medium text-foreground">
                        {c.startedCount}
                      </span>{' '}
                      started
                    </span>
                    <span aria-hidden>·</span>
                    <span>
                      <span className="font-medium text-foreground">
                        {c.completedCount}
                      </span>{' '}
                      done
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <FunnelBar
                    startedPercent={c.startedPercent}
                    completedPercent={c.completedPercent}
                  />
                  <span className="w-9 text-right text-[11px] tabular-nums text-muted-foreground">
                    {c.completedPercent}%
                  </span>
                </div>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function FunnelBar({
  startedPercent,
  completedPercent,
}: {
  startedPercent: number
  completedPercent: number
}) {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded bg-muted">
      {/* "Started but not yet completed" — translucent primary. */}
      <div
        className="absolute inset-y-0 left-0 bg-primary/30"
        style={{ width: `${startedPercent}%` }}
        aria-hidden
      />
      {/* "Completed" — solid primary, drawn over the translucent fill
          so the visible primary-tone band is the completed portion. */}
      <div
        className="absolute inset-y-0 left-0 bg-primary"
        style={{ width: `${completedPercent}%` }}
        aria-hidden
      />
    </div>
  )
}
