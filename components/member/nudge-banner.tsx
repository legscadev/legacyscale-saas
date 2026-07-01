'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Bell, X } from 'lucide-react'
import { toast } from 'sonner'

import { dismissNudgeAction } from '@/app/(user)/nudge-actions'
import { Button } from '@/components/ui/button'
import type { ActiveNudge } from '@/lib/services/nudge-service'

interface NudgeBannerProps {
  nudges: ActiveNudge[]
}

/**
 * Renders one banner per active nudge stacked vertically. Each has a
 * dismiss button that stamps dismissedAt on the server and hides the
 * banner locally. Optimistic — server error rolls the row back into
 * view.
 */
export function NudgeBanner({ nudges }: NudgeBannerProps) {
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const visible = nudges.filter((n) => !hidden.has(n.id))
  if (visible.length === 0) return null

  return (
    <div className="space-y-2">
      {visible.map((n) => (
        <NudgeCard
          key={n.id}
          nudge={n}
          onDismissed={() =>
            setHidden((prev) => {
              const next = new Set(prev)
              next.add(n.id)
              return next
            })
          }
          onRollback={() =>
            setHidden((prev) => {
              const next = new Set(prev)
              next.delete(n.id)
              return next
            })
          }
        />
      ))}
    </div>
  )
}

interface NudgeCardProps {
  nudge: ActiveNudge
  onDismissed: () => void
  onRollback: () => void
}

function NudgeCard({ nudge, onDismissed, onRollback }: NudgeCardProps) {
  const [pending, startTransition] = useTransition()

  function handleDismiss() {
    onDismissed()
    startTransition(async () => {
      const result = await dismissNudgeAction(nudge.id)
      if (!result.ok) {
        toast.error(result.error)
        onRollback()
      }
    })
  }

  const ctaHref = nudge.course ? `/courses/${nudge.course.slug}` : '/dashboard'
  const ctaLabel = nudge.course
    ? `Resume ${nudge.course.title}`
    : 'Open dashboard'

  return (
    <div className="flex items-start gap-3 rounded-lg border border-brand-500/30 bg-brand-500/[0.04] p-4">
      <div className="grid size-9 shrink-0 place-items-center rounded-md bg-brand-500/15 text-brand-600 ring-1 ring-brand-500/20">
        <Bell className="size-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-brand-600">
          A nudge from Kondense
        </p>
        <p className="whitespace-pre-wrap text-sm text-foreground">
          {nudge.message}
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button size="sm" render={<Link href={ctaHref} />}>
            {ctaLabel}
          </Button>
          <button
            type="button"
            onClick={handleDismiss}
            disabled={pending}
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
          >
            Dismiss
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        disabled={pending}
        aria-label="Dismiss nudge"
        className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
