'use client'

import { useRef, useState, useTransition } from 'react'
import { ImagePlus, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { updateAvatarUrl } from './actions'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const BUCKET = 'avatars'

interface AvatarUploadProps {
  authId: string
  /** Server-rendered initial value. */
  initialAvatarUrl: string | null
  /** Used for the fallback when no avatar exists. */
  fallbackText: string
}

function extensionOf(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'bin'
}

export function AvatarUpload({
  authId,
  initialAvatarUrl,
  fallbackText,
}: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [_isPending, startTransition] = useTransition()

  const pickFile = () => inputRef.current?.click()

  const handleFile = async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Use a JPG, PNG, or WEBP image.')
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error('Image must be 5 MB or smaller.')
      return
    }

    // Show preview while uploading.
    const localUrl = URL.createObjectURL(file)
    setPreviewUrl(localUrl)
    setUploading(true)

    const supabase = createClient()
    // Path: <authId>/<uuid>.<ext>. RLS enforces the first folder
    // matches the signed-in user's auth uid.
    const path = `${authId}/${crypto.randomUUID()}.${extensionOf(file.type)}`

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        contentType: file.type,
        cacheControl: '3600',
      })

    if (uploadErr) {
      console.error('Avatar upload failed:', uploadErr.message)
      toast.error('Upload failed — please try again')
      setUploading(false)
      URL.revokeObjectURL(localUrl)
      setPreviewUrl(null)
      return
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(path)

    startTransition(async () => {
      const result = await updateAvatarUrl(publicUrl)
      if (result.success) {
        setAvatarUrl(result.avatarUrl)
        toast.success('Profile photo updated')
      } else {
        toast.error(result.error)
      }
      URL.revokeObjectURL(localUrl)
      setPreviewUrl(null)
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    })
  }

  const displayUrl = previewUrl ?? avatarUrl ?? undefined

  const canOpenLightbox = !!avatarUrl && !uploading

  return (
    <div className="flex items-center gap-4">
      {canOpenLightbox ? (
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          aria-label="View profile photo"
          className="rounded-full ring-offset-background transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:opacity-90"
        >
          <Avatar className="h-16 w-16 cursor-zoom-in">
            <AvatarImage src={displayUrl} alt="" />
            <AvatarFallback className="text-lg">{fallbackText}</AvatarFallback>
          </Avatar>
        </button>
      ) : (
        <Avatar className="h-16 w-16">
          {displayUrl ? <AvatarImage src={displayUrl} alt="" /> : null}
          <AvatarFallback className="text-lg">{fallbackText}</AvatarFallback>
        </Avatar>
      )}
      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={pickFile}
          disabled={uploading}
        >
          {uploading ? (
            <>
              <Upload className="animate-pulse" />
              Uploading…
            </>
          ) : (
            <>
              <ImagePlus />
              {avatarUrl ? 'Replace photo' : 'Upload photo'}
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          JPG, PNG, or WEBP. Up to 5 MB.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent
          className="max-w-[min(90vw,640px)] gap-0 overflow-hidden border-none bg-transparent p-0 ring-0 shadow-none"
          showCloseButton={false}
        >
          {/* Visually hidden — satisfies the dialog accessibility
              contract without showing a header on the lightbox. */}
          <DialogTitle className="sr-only">Profile photo</DialogTitle>
          {avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt="Profile photo"
              className="block max-h-[80vh] w-full rounded-xl object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
