'use client'

// Create-deal dialog. Single-column form — deal name is the only
// required field; everything else (value, contact, company, closer,
// expected close, stage) is optional. On submit it calls
// createOpportunityAction and hands the new card back to the shell
// for an optimistic insert.

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

import { createOpportunityAction } from '@/app/(admin)/admin/crm/pipeline/actions'
import type { OpportunityListItem } from '@/lib/services/crm-opportunity-service'
import type { PipelineStage } from '@/lib/services/crm-pipeline-service'
import type { CrmTeamMember } from '@/app/(admin)/admin/crm/pipeline/actions'

interface CreateOpportunityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pipelineId: string
  stages: PipelineStage[]
  members: CrmTeamMember[]
  /** Pre-selected stage when opened from a column's "add" affordance. */
  defaultStageId?: string
  onCreated: (deal: OpportunityListItem) => void
}

export function CreateOpportunityDialog({
  open,
  onOpenChange,
  pipelineId,
  stages,
  members,
  defaultStageId,
  onCreated,
}: CreateOpportunityDialogProps) {
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [stageId, setStageId] = useState(defaultStageId ?? '')
  const [assignedCloserId, setAssignedCloserId] = useState('')
  const [expectedCloseDate, setExpectedCloseDate] = useState('')
  const [notes, setNotes] = useState('')

  function reset() {
    setName('')
    setValue('')
    setCompanyName('')
    setContactName('')
    setContactEmail('')
    setContactPhone('')
    setStageId(defaultStageId ?? '')
    setAssignedCloserId('')
    setExpectedCloseDate('')
    setNotes('')
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Deal name is required')
      return
    }

    const parsedValue = value.trim() === '' ? null : Number(value)
    if (parsedValue !== null && Number.isNaN(parsedValue)) {
      toast.error('Deal value must be a number')
      return
    }

    startTransition(async () => {
      const res = await createOpportunityAction(pipelineId, {
        name: name.trim(),
        stageId: stageId || undefined,
        value: parsedValue,
        companyName: companyName.trim() || null,
        contactName: contactName.trim() || null,
        contactEmail: contactEmail.trim() || null,
        contactPhone: contactPhone.trim() || null,
        assignedCloserId: assignedCloserId || null,
        expectedCloseDate: expectedCloseDate || undefined,
        notes: notes.trim() || null,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not create deal')
        return
      }
      toast.success('Deal added')
      onCreated(res.data)
      handleOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New deal</DialogTitle>
            <DialogDescription>
              Add an opportunity to the pipeline. Only a name is required.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="opp-name">Deal name</Label>
              <Input
                id="opp-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Corp — annual plan"
                autoFocus
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="opp-value">Value (USD)</Label>
                <Input
                  id="opp-value"
                  type="number"
                  min={0}
                  step="any"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="5000"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="opp-close">Expected close</Label>
                <Input
                  id="opp-close"
                  type="date"
                  value={expectedCloseDate}
                  onChange={(e) => setExpectedCloseDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="opp-company">Company</Label>
                <Input
                  id="opp-company"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Corp"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="opp-contact">Contact name</Label>
                <Input
                  id="opp-contact"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Jane Doe"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="opp-email">Contact email</Label>
                <Input
                  id="opp-email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="jane@acme.com"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="opp-phone">Contact phone</Label>
                <Input
                  id="opp-phone"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+1 555 010 0000"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="opp-stage">Stage</Label>
                <select
                  id="opp-stage"
                  value={stageId}
                  onChange={(e) => setStageId(e.target.value)}
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">First stage</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="opp-closer">Assigned closer</Label>
                <select
                  id="opp-closer"
                  value={assignedCloserId}
                  onChange={(e) => setAssignedCloserId(e.target.value)}
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name ?? m.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="opp-notes">Notes</Label>
              <Textarea
                id="opp-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Context, next steps…"
                rows={3}
              />
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
              {pending ? 'Adding…' : 'Add deal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
