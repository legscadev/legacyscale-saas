'use client'

import { useRef, useState } from 'react'
import MuxPlayer from '@mux/mux-player-react'
import { AlertCircle } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { setLessonCompleteAction } from '@/app/(user)/courses/[courseId]/lessons/[lessonId]/actions'

interface MuxLessonPlayerProps {
  lessonId: string
  playbackId: string
  title: string
  startSeconds?: number
  alreadyComplete: boolean
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
}: MuxLessonPlayerProps) {
  const [errored, setErrored] = useState(false)
  const firedRef = useRef(alreadyComplete)

  const handleEnded = () => {
    if (firedRef.current) return
    firedRef.current = true
    void setLessonCompleteAction(lessonId, true)
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
    <div className="overflow-hidden rounded-xl bg-black ring-1 ring-white/10">
      <MuxPlayer
        playbackId={playbackId}
        streamType="on-demand"
        metadata={{ video_title: title }}
        startTime={startSeconds || undefined}
        accentColor="hsl(var(--primary))"
        primaryColor="#ffffff"
        style={{ aspectRatio: '16 / 9', width: '100%' }}
        onEnded={handleEnded}
        onError={() => setErrored(true)}
      />
    </div>
  )
}
