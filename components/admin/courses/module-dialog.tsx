'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export interface ModuleDialogValues {
  title: string
  description: string | null
}

interface ModuleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  // Pre-fill values when editing. For create the dialog starts blank.
  initial?: ModuleDialogValues
  onSubmit: (values: ModuleDialogValues) => Promise<{ ok: boolean }>
}

export function ModuleDialog({
  open,
  onOpenChange,
  mode,
  initial,
  onSubmit,
}: ModuleDialogProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [saving, setSaving] = useState(false)

  // Reset fields when the dialog opens with new initial values.
  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? '')
      setDescription(initial?.description ?? '')
    }
  }, [open, initial?.title, initial?.description])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return

    setSaving(true)
    try {
      const result = await onSubmit({
        title: trimmedTitle,
        description: description.trim() || null,
      })
      if (result.ok) onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {mode === 'create' ? 'New module' : 'Edit module'}
            </DialogTitle>
            <DialogDescription>
              Modules group related chapters together. Members see them as
              expandable sections inside the course.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="module-title">Title</Label>
            <Input
              id="module-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Getting Clients"
              maxLength={200}
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="module-description">
              Description{' '}
              <span className="text-muted-foreground/70">(optional)</span>
            </Label>
            <Textarea
              id="module-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What members will learn in this module"
              rows={3}
              maxLength={2000}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !title.trim()}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              {mode === 'create' ? 'Create module' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
