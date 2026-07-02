'use client'

import { useState } from 'react'
import { Bell } from 'lucide-react'

import { NudgeDialog } from '@/components/admin/members/nudge-dialog'

interface NudgeRowActionProps {
  memberId: string
  memberName: string
  /** Optional visual variant. 'icon' is compact enough to sit next
   *  to progress metadata inside a row; 'button' is a full button
   *  for hero sections. */
  variant?: 'icon' | 'button'
}

/**
 * Client-side trigger for the nudge dialog that can sit inside a
 * parent `<Link>` row without triggering navigation. Every click
 * handler stops propagation + prevents the wrapper anchor's default.
 */
export function NudgeRowAction({
  memberId,
  memberName,
  variant = 'icon',
}: NudgeRowActionProps) {
  const [open, setOpen] = useState(false)

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setOpen(true)
  }

  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={handleClick}
          aria-label="Send nudge"
          className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Bell className="size-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
        >
          <Bell className="size-4" />
          Send nudge
        </button>
      )}
      <NudgeDialog
        open={open}
        onOpenChange={setOpen}
        memberId={memberId}
        memberName={memberName}
      />
    </>
  )
}
