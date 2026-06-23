'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import MuxPlayer from '@mux/mux-player-react'
import { AlertCircle } from 'lucide-react'

import { Card } from '@/components/ui/card'
import {
  setLessonCompleteAction,
  updateLessonPositionAction,
} from '@/app/(user)/courses/[slug]/lessons/[lessonId]/actions'
import { useAutoplayPreference } from '@/hooks/use-autoplay-preference'
import { AutoNextOverlay } from './auto-next-overlay'

const POSITION_SAVE_INTERVAL_MS = 5000

interface MuxLessonPlayerProps {
  lessonId: string
  playbackId: string
  title: string
  startSeconds?: number
  alreadyComplete: boolean
  /** When true, fires autoplay on mount — used by the chained nav from the overlay. */
  autoPlay?: boolean
  /** When set, the post-video autoplay overlay can navigate here. */
  nextHref?: string
  nextTitle?: string
}

/**
 * Member-side Mux player. Fires the mark-complete action on the Mux
 * `ended` event (4.8) the first time the video reaches its end in a
 * session; the server's revalidate then flows the new completed
 * state back into the page.
 *
 * Surfaces a soft fallback card if Mux throws during playback (4.15).
 */
export function MuxLessonPlayer({
  lessonId,
  playbackId,
  title,
  startSeconds = 0,
  alreadyComplete,
  autoPlay = false,
  nextHref,
  nextTitle,
}: MuxLessonPlayerProps) {
  const [errored, setErrored] = useState(false)
  const [showAutoNext, setShowAutoNext] = useState(false)
  const firedRef = useRef(alreadyComplete)
  const lastPositionSaveRef = useRef(0)
  const { enabled: autoplayEnabled } = useAutoplayPreference()
  const router = useRouter()
  const pathname = usePathname()

  // Strip the ?autoplay=1 marker from the URL once it's served its
  // purpose, so a subsequent refresh doesn't re-fire autoplay.
  useEffect(() => {
    if (!autoPlay) return
    router.replace(pathname, { scroll: false })
  }, [autoPlay, pathname, router])

  const handleEnded = () => {
    // Always run the mark-complete side effect once; only run the
    // navigation overlay if autoplay is on and there's somewhere to
    // go. Await the action before showing the overlay so the next
    // page's gating check finds the lesson already complete (no
    // bounce back).
    const alreadyFired = firedRef.current
    firedRef.current = true
    void (async () => {
      const result = alreadyFired
        ? null
        : await setLessonCompleteAction(lessonId, true)
      // If this `ended` event flipped the whole course to 100%,
      // navigate to the celebration screen and skip the autoplay
      // overlay — there's no "next lesson" to chain into anyway.
      if (result?.justCompleted && result.courseSlug) {
        router.push(`/courses/${result.courseSlug}/complete`)
        return
      }
      if (autoplayEnabled && nextHref && nextTitle) {
        setShowAutoNext(true)
      }
    })()
  }

  const savePosition = (target: EventTarget | null) => {
    const media = target as HTMLMediaElement | null
    if (!media) return
    const seconds = Math.floor(media.currentTime)
    if (seconds < 1) return
    lastPositionSaveRef.current = Date.now()
    void updateLessonPositionAction(lessonId, seconds)
  }

  const handleTimeUpdate = (event: Event) => {
    if (Date.now() - lastPositionSaveRef.current < POSITION_SAVE_INTERVAL_MS) {
      return
    }
    savePosition(event.target)
  }

  const handlePause = (event: Event) => {
    savePosition(event.target)
  }

  if (errored) {
    return (
      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <span className="grid size-12 place-items-center rounded-xl bg-error/10 text-error">
          <AlertCircle className="size-6" />
        </span>
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold">Playback failed</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            We couldn&apos;t load this video. Refresh the page or check
            back in a moment. If it keeps happening, contact support.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-xl bg-black ring-1 ring-white/10">
      <MuxPlayer
        playbackId={playbackId}
        streamType="on-demand"
        metadata={{ video_title: title }}
        startTime={startSeconds || undefined}
        autoPlay={autoPlay ? 'any' : undefined}
        accentColor="hsl(var(--primary))"
        primaryColor="#ffffff"
        style={{ aspectRatio: '16 / 9', width: '100%' }}
        onEnded={handleEnded}
        onError={() => setErrored(true)}
        onTimeUpdate={handleTimeUpdate}
        onPause={handlePause}
      />
      {showAutoNext && nextHref && nextTitle ? (
        <AutoNextOverlay
          nextHref={nextHref}
          nextTitle={nextTitle}
          onCancel={() => setShowAutoNext(false)}
        />
      ) : null}
    </div>
  )
}
