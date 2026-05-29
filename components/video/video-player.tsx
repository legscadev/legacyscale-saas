'use client'

import MuxPlayerReact from '@mux/mux-player-react'
import { cn } from '@/lib/utils'

interface VideoPlayerProps {
  playbackId: string
  title?: string
  className?: string
}

// Wrapper around Mux's official React player. Handles HLS playback,
// captions, controls, and analytics out of the box.
export function VideoPlayer({ playbackId, title, className }: VideoPlayerProps) {
  return (
    <div
      className={cn(
        'aspect-video w-full overflow-hidden rounded-lg bg-black',
        className
      )}
    >
      <MuxPlayerReact
        streamType="on-demand"
        playbackId={playbackId}
        metadata={{ video_id: playbackId, video_title: title }}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
