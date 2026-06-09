'use client'

import { useRef, useState, useTransition } from 'react'
import { ImagePlus, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { AvatarLightbox } from '@/components/shared'
import { createClient } from '@/lib/supabase/client'
import { updateAvatarUrl } from '@/lib/actions/profile'

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

  // Only the persisted URL opens the lightbox; the local preview blob
  // is short-lived and not worth zooming into.
  const lightboxUrl = uploading ? null : avatarUrl

  return (
    <div className="flex items-center gap-4">
      <AvatarLightbox photoUrl={lightboxUrl} label="View profile photo" alt="Profile photo">
        <Avatar className="h-16 w-16">
          {displayUrl ? <AvatarImage src={displayUrl} alt="" /> : null}
          <AvatarFallback className="text-lg">{fallbackText}</AvatarFallback>
        </Avatar>
      </AvatarLightbox>
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
    </div>
  )
}
