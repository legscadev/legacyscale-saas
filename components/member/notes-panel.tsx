'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Loader2, AlertTriangle } from 'lucide-react'

import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

interface NotesPanelProps {
  lessonId: string
}

type SaveState = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

// Wait this long after the last keystroke before auto-saving. Blur
// fires the save immediately, so the debounce only matters while
// the user is actively typing.
const AUTOSAVE_DEBOUNCE_MS = 3000

// How long the "Saved" indicator stays visible before fading to idle.
const SAVED_FLASH_MS = 2500

export function NotesPanel({ lessonId }: NotesPanelProps) {
  const [value, setValue] = useState('')
  const [state, setState] = useState<SaveState>('loading')
  // Track the last successfully persisted value so we can skip
  // saves that wouldn't change anything (avoids hammering the API on
  // blur of an unchanged note).
  const lastSavedRef = useRef('')
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Load on mount. We don't gate this on tab visibility — the panel
  // only mounts when the user clicks the Notes tab, so the fetch is
  // already lazy enough.
  useEffect(() => {
    let cancelled = false
    setState('loading')
    fetch(`/api/notes/${lessonId}`, { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Load failed: ${res.status}`)
        const json = (await res.json()) as { data: { content: string } }
        if (cancelled) return
        setValue(json.data.content)
        lastSavedRef.current = json.data.content
        setState('idle')
      })
      .catch((err) => {
        console.error('Failed to load note:', err)
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [lessonId])

  const save = useCallback(
    async (next: string) => {
      if (next === lastSavedRef.current) return
      // Cancel any in-flight save so we don't race the upsert.
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setState('saving')
      try {
        const res = await fetch(`/api/notes/${lessonId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ content: next }),
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`Save failed: ${res.status}`)
        lastSavedRef.current = next
        setState('saved')

        if (savedFlashTimerRef.current) {
          clearTimeout(savedFlashTimerRef.current)
        }
        savedFlashTimerRef.current = setTimeout(
          () => setState('idle'),
          SAVED_FLASH_MS,
        )
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        console.error('Failed to save note:', err)
        setState('error')
      }
    },
    [lessonId],
  )

  // Debounced save while typing. Resets the 3s timer on every change.
  useEffect(() => {
    if (state === 'loading') return
    if (value === lastSavedRef.current) return

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      void save(value)
    }, AUTOSAVE_DEBOUNCE_MS)

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [value, state, save])

  // Cancel timers + abort in-flight request on unmount.
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      if (savedFlashTimerRef.current) clearTimeout(savedFlashTimerRef.current)
      abortRef.current?.abort()
    }
  }, [])

  function handleBlur() {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    if (value !== lastSavedRef.current) {
      void save(value)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">My notes</p>
        <SaveIndicator state={state} onRetry={() => save(value)} />
      </div>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        placeholder="Jot down key takeaways from this lesson…"
        className="min-h-32 resize-none"
        disabled={state === 'loading'}
      />
    </div>
  )
}

function SaveIndicator({
  state,
  onRetry,
}: {
  state: SaveState
  onRetry: () => void
}) {
  if (state === 'loading') {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Loading…
      </span>
    )
  }
  if (state === 'saving') {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Saving…
      </span>
    )
  }
  if (state === 'saved') {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Check className="size-3 text-success" /> Saved
      </span>
    )
  }
  if (state === 'error') {
    return (
      <span className="flex items-center gap-1 text-xs text-destructive">
        <AlertTriangle className="size-3" /> Save failed
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs text-destructive underline"
          onClick={onRetry}
        >
          Retry
        </Button>
      </span>
    )
  }
  return null
}
