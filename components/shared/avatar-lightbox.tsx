'use client'

import { useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface AvatarLightboxProps {
  /** The full-size photo URL. When falsy, the wrapper is inert. */
  photoUrl: string | null | undefined
  /** Accessible label for the trigger button (default "View photo"). */
  label?: string
  /** Accessible alt for the enlarged image (default "Photo"). */
  alt?: string
  /** The Avatar component to render. */
  children: React.ReactNode
  className?: string
}

/**
 * Wraps an Avatar so clicking it opens a centered lightbox of the
 * full-size photo. Renders the avatar as-is (no button, no cursor)
 * when there's no photo to enlarge.
 */
export function AvatarLightbox({
  photoUrl,
  label = 'View photo',
  alt = 'Photo',
  children,
  className,
}: AvatarLightboxProps) {
  const [open, setOpen] = useState(false)

  if (!photoUrl) {
    return <>{children}</>
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          // Stop bubbling so table-row click handlers don't fire.
          e.stopPropagation()
          setOpen(true)
        }}
        aria-label={label}
        className={cn(
          'rounded-full ring-offset-background transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:opacity-90',
          className,
        )}
      >
        <span className="block cursor-zoom-in rounded-full">{children}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-[min(90vw,640px)] gap-0 overflow-hidden border-none bg-transparent p-0 ring-0 shadow-none"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt={alt}
            className="block max-h-[80vh] w-full rounded-xl object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
