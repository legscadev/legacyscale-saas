'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Film, Maximize, Pause, Play, Settings, Volume2 } from 'lucide-react'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

interface VideoFrameProps {
  durationSeconds: number
  positionSeconds?: number
  title?: string
}

/**
 * Visual placeholder for the lesson player. Phase C replaces this
 * with the actual Mux player wired to muxPlaybackId.
 */
export function VideoFrame({
  durationSeconds,
  positionSeconds = 0,
  title,
}: VideoFrameProps) {
  const [playing, setPlaying] = useState(false)
  const percent = durationSeconds
    ? Math.min(100, (positionSeconds / durationSeconds) * 100)
    : 0

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 via-zinc-950 to-black ring-1 ring-white/10">
      <div className="pointer-events-none absolute left-1/2 top-1/3 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/25 blur-3xl" />

      <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-medium text-white/80 ring-1 ring-inset ring-white/10 backdrop-blur">
        <Film className="size-3.5" />
        Video lesson
      </div>

      <Image
        src="/kondense-logo.png"
        alt=""
        width={28}
        height={28}
        className="absolute right-3 top-3 size-7 opacity-60"
      />

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <button
          onClick={() => setPlaying((v) => !v)}
          aria-label={playing ? 'Pause' : 'Play'}
          className="group flex size-20 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-inset ring-white/20 backdrop-blur transition-all hover:scale-105 hover:bg-primary hover:ring-primary active:scale-95"
        >
          {playing ? (
            <Pause className="size-8" />
          ) : (
            <Play className="size-8 translate-x-0.5" />
          )}
        </button>
        <div className="space-y-1">
          {title ? (
            <p className="line-clamp-2 max-w-md text-sm font-medium text-white/90">
              {title}
            </p>
          ) : null}
          <p className="text-xs text-white/45">
            Video preview · {formatDuration(durationSeconds)}
          </p>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 space-y-2 bg-gradient-to-t from-black/80 to-transparent p-3">
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="flex items-center gap-3 text-white">
          <button onClick={() => setPlaying((v) => !v)} aria-label="Toggle play">
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <Volume2 className="size-4" />
          <span className="text-xs tabular-nums">
            {formatDuration(positionSeconds)} / {formatDuration(durationSeconds)}
          </span>
          <div className="ml-auto flex items-center gap-3">
            <Settings className="size-4" />
            <Maximize className="size-4" />
          </div>
        </div>
      </div>
    </div>
  )
}
