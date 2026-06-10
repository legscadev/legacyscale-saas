'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'

import { Textarea } from '@/components/ui/textarea'

/**
 * Visual stub for per-lesson notes with a mock autosave indicator.
 * Actual persistence to the Note model lands in a later phase.
 */
export function NotesPanel({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')

  useEffect(() => {
    if (state !== 'saving') return
    const t = setTimeout(() => setState('saved'), 700)
    return () => clearTimeout(t)
  }, [state])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">My notes</p>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {state === 'saving' ? (
            <>
              <Loader2 className="size-3 animate-spin" /> Saving…
            </>
          ) : state === 'saved' ? (
            <>
              <Check className="size-3 text-success" /> Saved
            </>
          ) : null}
        </span>
      </div>
      <Textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setState('saving')
        }}
        placeholder="Jot down key takeaways from this lesson…"
        className="min-h-32 resize-none"
      />
    </div>
  )
}
