'use client'

// Create-pipeline dialog. A tenant can run several pipelines (e.g.
// "New Business", "Renewals"). Name + an editable list of stage names
// (one per line, pre-filled with the standard sales stages). A stage
// named "Won"/"Lost" is auto-flagged terminal by the service.

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

import { createPipelineAction } from '@/app/(admin)/admin/crm/pipeline/actions'
import type { PipelineSummary } from '@/lib/services/crm-pipeline-service'

// Kept in sync with DEFAULT_STAGE_NAMES in crm-pipeline-service.ts.
// Inlined (not imported) so this client component doesn't pull the
// Prisma-backed service into the browser bundle.
const DEFAULT_STAGE_TEXT = [
  'New Lead',
  'Contacted',
  'Qualified',
  'Appointment Scheduled',
  'Presentation',
  'Proposal Sent',
  'Negotiation',
  'Won',
  'Lost',
].join('\n')

interface CreatePipelineDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (pipeline: PipelineSummary) => void
}

export function CreatePipelineDialog({
  open,
  onOpenChange,
  onCreated,
}: CreatePipelineDialogProps) {
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [stagesText, setStagesText] = useState(DEFAULT_STAGE_TEXT)

  function reset() {
    setName('')
    setStagesText(DEFAULT_STAGE_TEXT)
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Pipeline name is required')
      return
    }
    const stageNames = stagesText
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
    if (stageNames.length === 0) {
      toast.error('Add at least one stage')
      return
    }

    startTransition(async () => {
      const res = await createPipelineAction({ name: name.trim(), stageNames })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not create pipeline')
        return
      }
      toast.success('Pipeline created')
      onCreated(res.data)
      handleOpenChange(false)
    })
  }

  const stageCount = stagesText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean).length

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New pipeline</DialogTitle>
            <DialogDescription>
              A separate board with its own stages — e.g. New Business,
              Renewals, Partnerships.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="pipeline-name">Name</Label>
              <Input
                id="pipeline-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Renewals"
                autoFocus
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pipeline-stages">
                Stages <span className="text-muted-foreground">(one per line, {stageCount})</span>
              </Label>
              <Textarea
                id="pipeline-stages"
                value={stagesText}
                onChange={(e) => setStagesText(e.target.value)}
                rows={9}
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                A stage named “Won” or “Lost” is treated as a closed
                outcome.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create pipeline'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
