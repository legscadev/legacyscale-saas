'use client'

import { useMemo, useState, useTransition } from 'react'
import { SmilePlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { ANNOUNCEMENT_REACTION_PRESETS } from '@/lib/validations/announcement'
import { toggleReactionAction } from '@/app/(user)/announcements/actions'

interface AnnouncementReactionsProps {
  announcementId: string
  reactions: { emoji: string; userId: string }[]
  viewerUserId?: string
  className?: string
}

interface AggregatedReaction {
  emoji: string
  count: number
  mine: boolean
}

function aggregate(
  rows: { emoji: string; userId: string }[],
  viewerUserId: string | undefined,
): AggregatedReaction[] {
  const byEmoji = new Map<string, AggregatedReaction>()
  for (const row of rows) {
    let bucket = byEmoji.get(row.emoji)
    if (!bucket) {
      bucket = { emoji: row.emoji, count: 0, mine: false }
      byEmoji.set(row.emoji, bucket)
    }
    bucket.count++
    if (viewerUserId && row.userId === viewerUserId) bucket.mine = true
  }
  // Most-used emoji first; tie-break alphabetically so the order is
  // stable across renders.
  return Array.from(byEmoji.values()).sort(
    (a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji),
  )
}

export function AnnouncementReactions({
  announcementId,
  reactions,
  viewerUserId,
  className,
}: AnnouncementReactionsProps) {
  // Local optimistic copy so taps feel instant. Server reconciles on
  // the next render; if the action errors we revert.
  const [rows, setRows] = useState(reactions)
  const [pending, startTransition] = useTransition()
  const [pickerOpen, setPickerOpen] = useState(false)

  const aggregated = useMemo(() => aggregate(rows, viewerUserId), [rows, viewerUserId])

  function toggle(emoji: string) {
    if (!viewerUserId) return
    const before = rows
    const mineHere = rows.some(
      (r) => r.emoji === emoji && r.userId === viewerUserId,
    )
    setRows(
      mineHere
        ? rows.filter((r) => !(r.emoji === emoji && r.userId === viewerUserId))
        : [...rows, { emoji, userId: viewerUserId }],
    )
    setPickerOpen(false)
    startTransition(async () => {
      const res = await toggleReactionAction(announcementId, emoji)
      if (!res.ok) setRows(before)
    })
  }

  const canReact = !!viewerUserId

  return (
    <div
      className={cn('flex flex-wrap items-center gap-1.5', className)}
      data-pending={pending}
    >
      {aggregated.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => toggle(r.emoji)}
          disabled={!canReact}
          className={cn(
            'inline-flex h-7 items-center gap-1 rounded-full border bg-muted/40 px-2 text-xs tabular-nums transition-colors',
            r.mine
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'hover:border-foreground/20 hover:bg-muted',
            !canReact && 'cursor-not-allowed opacity-70',
          )}
          aria-pressed={r.mine}
          aria-label={`${r.emoji} reaction, ${r.count} ${r.mine ? '(yours)' : ''}`}
        >
          <span>{r.emoji}</span>
          <span>{r.count}</span>
        </button>
      ))}
      {canReact ? (
        <DropdownMenu open={pickerOpen} onOpenChange={setPickerOpen}>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Add reaction"
                className="h-7 w-7"
              />
            }
          >
            <SmilePlus className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="p-1.5">
            <div className="flex items-center gap-1">
              {ANNOUNCEMENT_REACTION_PRESETS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => toggle(emoji)}
                  className="grid size-8 place-items-center rounded-md text-base transition-colors hover:bg-muted"
                  aria-label={`React with ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}
