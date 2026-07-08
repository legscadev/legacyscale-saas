'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

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
import {
  createDivisionAction,
  updateDivisionAction,
} from '@/app/(admin)/admin/stats/actions'

export interface DivisionInitial {
  id: string
  name: string
  shortLabel: string | null
  description: string | null
}

interface DivisionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present = edit mode. Absent = create mode. */
  initial?: DivisionInitial
  onCreated?: (id: string) => void
}

export function DivisionDialog({
  open,
  onOpenChange,
  initial,
  onCreated,
}: DivisionDialogProps) {
  const isEdit = !!initial
  const [name, setName] = useState(initial?.name ?? '')
  const [shortLabel, setShortLabel] = useState(initial?.shortLabel ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [pending, startTransition] = useTransition()

  // Re-seed fields when a fresh open switches the target row.
  const [primedFor, setPrimedFor] = useState<string | null>(null)
  const targetKey = initial?.id ?? '__create__'
  if (open && primedFor !== targetKey) {
    setPrimedFor(targetKey)
    setName(initial?.name ?? '')
    setShortLabel(initial?.shortLabel ?? '')
    setDescription(initial?.description ?? '')
  }
  if (!open && primedFor !== null) setPrimedFor(null)

  function reset() {
    setName('')
    setShortLabel('')
    setDescription('')
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  function handleSubmit() {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    startTransition(async () => {
      if (isEdit && initial) {
        const result = await updateDivisionAction(initial.id, {
          name,
          shortLabel: shortLabel || null,
          description: description || null,
        })
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success('Group updated')
        handleOpenChange(false)
      } else {
        const result = await createDivisionAction({
          name,
          shortLabel: shortLabel || null,
          description: description || null,
        })
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success('Group created')
        onCreated?.(result.id)
        handleOpenChange(false)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit group' : 'New group'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Rename or retag this group. Existing metrics keep their assignments.'
              : 'Top-level grouping for metrics — e.g. Marketing, Treasury, Production. Admin can rename later.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stat-div-name">Name</Label>
            <Input
              id="stat-div-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Marketing"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stat-div-short">Short label (optional)</Label>
            <Input
              id="stat-div-short"
              value={shortLabel}
              onChange={(e) => setShortLabel(e.target.value)}
              placeholder="Div 2"
            />
            <p className="text-xs text-muted-foreground">
              Displayed above the name in the tab. Keep it terse.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="stat-div-desc">Description (optional)</Label>
            <Textarea
              id="stat-div-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What this group is responsible for."
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending
              ? isEdit
                ? 'Saving…'
                : 'Creating…'
              : isEdit
                ? 'Save changes'
                : 'Create group'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
