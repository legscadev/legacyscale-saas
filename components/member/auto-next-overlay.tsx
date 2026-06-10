'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Play, X } from 'lucide-react'

const COUNTDOWN_SEC = 5

// Geometry of the SVG ring around the play button.
const RING_SIZE = 96
const RING_STROKE = 4
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

interface AutoNextOverlayProps {
  nextHref: string
  nextTitle: string
  onCancel: () => void
}

/**
 * Post-video countdown that nudges the user into the next lesson.
 * The play button is wrapped in an SVG ring that fills as the
 * countdown advances — same affordance Netflix / YouTube use.
 */
export function AutoNextOverlay({
  nextHref,
  nextTitle,
  onCancel,
}: AutoNextOverlayProps) {
  const router = useRouter()
  const [seconds, setSeconds] = useState(COUNTDOWN_SEC)

  // Tag the next URL so the landing page knows to fire autoPlay on
  // the Mux player. Without this signal a programmatic navigation
  // leaves the next video sitting on the poster.
  const autoplayHref = nextHref.includes('?')
    ? `${nextHref}&autoplay=1`
    : `${nextHref}?autoplay=1`

  useEffect(() => {
    if (seconds <= 0) {
      router.push(autoplayHref)
      return
    }
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [seconds, autoplayHref, router])

  // 0 (empty) → 1 (full). One-second transition keeps the ring
  // sweeping smoothly between discrete state ticks.
  const progress = (COUNTDOWN_SEC - seconds) / COUNTDOWN_SEC
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress)

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-black/85 px-6 text-center backdrop-blur-sm">
      <button
        type="button"
        onClick={onCancel}
        className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        aria-label="Cancel autoplay"
      >
        <X className="size-4" />
      </button>

      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/60">
          Up next
        </p>
        <h2 className="line-clamp-2 max-w-md text-xl font-semibold text-white">
          {nextTitle}
        </h2>
      </div>

      <button
        type="button"
        onClick={() => router.push(autoplayHref)}
        aria-label={`Play next lesson: ${nextTitle}`}
        className="group relative inline-flex items-center justify-center transition-transform duration-200 hover:scale-[1.06] active:scale-[0.97]"
        style={{ width: RING_SIZE, height: RING_SIZE }}
      >
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          className="-rotate-90"
          aria-hidden
        >
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={RING_STROKE}
            className="text-white/15"
          />
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            className="text-primary drop-shadow-[0_0_10px_hsl(var(--primary)/0.55)] transition-[stroke-dashoffset] duration-1000 ease-linear"
          />
        </svg>
        <span className="absolute inset-1.5 flex items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-inset ring-white/15 backdrop-blur-md transition-colors duration-200 group-hover:bg-primary group-hover:ring-primary">
          <Play className="size-7 translate-x-0.5 text-white transition-transform duration-200 group-hover:scale-110" />
        </span>
      </button>

      <p className="text-sm text-white/70">
        Playing in <span className="font-medium tabular-nums text-white">{seconds}s</span>
        <span aria-hidden className="px-1.5 text-white/30">·</span>
        <button
          type="button"
          onClick={onCancel}
          className="font-medium text-white/85 underline-offset-4 transition-colors hover:text-white hover:underline"
        >
          Cancel
        </button>
      </p>
    </div>
  )
}
