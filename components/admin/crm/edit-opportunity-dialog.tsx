'use client'

// Edit-deal dialog. Opened by clicking a card on the board. Loads the
// full opportunity (the board list omits email/phone/notes), lets the
// operator edit every field + move the deal to another stage, and
// delete it. Field edits go through updateOpportunityAction; a stage
// change routes through moveOpportunityAction (so WON/LOST status +
// close timestamps stay correct).

import { useEffect, useState, useTransition } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
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
import { toCalendarDateInput } from '@/lib/format'

import {
  deleteOpportunityAction,
  fetchOpportunityAction,
  moveOpportunityAction,
  updateOpportunityAction,
} from '@/app/(admin)/admin/crm/opportunities/actions'
import type { CrmTeamMember } from '@/app/(admin)/admin/crm/opportunities/actions'
import type { PipelineStage } from '@/lib/services/crm-pipeline-service'

const SELECT_CLASS =
  'h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

interface EditOpportunityDialogProps {
  opportunityId: string | null
  stages: PipelineStage[]
  members: CrmTeamMember[]
  onOpenChange: (open: boolean) => void
  onChanged: () => void
}

interface FormState {
  /** The opportunity this form was loaded for — lets us derive the
   *  loading state without a synchronous setState in the effect. */
  id: string
  name: string
  value: string
  companyName: string
  contactName: string
  contactEmail: string
  contactPhone: string
  probability: string
  expectedCloseDate: string
  assignedCloserId: string
  notes: string
  stageId: string
}

export function EditOpportunityDialog({
  opportunityId,
  stages,
  members,
  onOpenChange,
  onChanged,
}: EditOpportunityDialogProps) {
  const [pending, startTransition] = useTransition()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [form, setForm] = useState<FormState | null>(null)
  const [initialStageId, setInitialStageId] = useState<string>('')

  // Loading is derived — true whenever a card is open but its data
  // hasn't arrived (or belongs to a previously-opened card). Avoids a
  // synchronous setState in the effect.
  const loading = !!opportunityId && form?.id !== opportunityId

  // Load full detail whenever a different card is opened. All state
  // updates happen in the async callback (never synchronously in the
  // effect body) so this can't trigger cascading renders.
  useEffect(() => {
    if (!opportunityId) return
    let cancelled = false
    fetchOpportunityAction(opportunityId).then((res) => {
      if (cancelled) return
      if (!res.ok) {
        toast.error(res.error ?? 'Could not load deal')
        onOpenChange(false)
        return
      }
      const d = res.data
      setInitialStageId(d.stageId)
      setConfirmingDelete(false)
      setForm({
        id: d.id,
        name: d.name,
        value: d.value === null ? '' : String(d.value),
        companyName: d.companyName ?? '',
        contactName: d.contactName ?? '',
        contactEmail: d.contactEmail ?? '',
        contactPhone: d.contactPhone ?? '',
        probability: d.probability === null ? '' : String(d.probability),
        expectedCloseDate: d.expectedCloseDate
          ? toCalendarDateInput(d.expectedCloseDate)
          : '',
        assignedCloserId: d.assignedCloser?.id ?? '',
        notes: d.notes ?? '',
        stageId: d.stageId,
      })
    })
    return () => {
      cancelled = true
    }
  }, [opportunityId, onOpenChange])

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: val } : prev))
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form || !opportunityId) return
    if (!form.name.trim()) {
      toast.error('Opportunity name is required')
      return
    }
    const parsedValue = form.value.trim() === '' ? null : Number(form.value)
    if (parsedValue !== null && Number.isNaN(parsedValue)) {
      toast.error('Value must be a number')
      return
    }
    const parsedProb =
      form.probability.trim() === '' ? null : Number(form.probability)
    if (parsedProb !== null && (Number.isNaN(parsedProb) || parsedProb < 0 || parsedProb > 100)) {
      toast.error('Probability must be 0–100')
      return
    }

    startTransition(async () => {
      const res = await updateOpportunityAction(opportunityId, {
        name: form.name.trim(),
        value: parsedValue,
        companyName: form.companyName.trim() || null,
        contactName: form.contactName.trim() || null,
        contactEmail: form.contactEmail.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        probability: parsedProb,
        expectedCloseDate: form.expectedCloseDate || undefined,
        assignedCloserId: form.assignedCloserId || null,
        notes: form.notes.trim() || null,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not save opportunity')
        return
      }
      // Stage change routes through the move path so WON/LOST + close
      // timestamps update.
      if (form.stageId && form.stageId !== initialStageId) {
        const moveRes = await moveOpportunityAction({
          opportunityId,
          stageId: form.stageId,
        })
        if (!moveRes.ok) {
          toast.error(moveRes.error ?? 'Saved, but could not move stage')
          onChanged()
          onOpenChange(false)
          return
        }
      }
      toast.success('Opportunity updated')
      onChanged()
      onOpenChange(false)
    })
  }

  function handleDelete() {
    if (!opportunityId) return
    startTransition(async () => {
      const res = await deleteOpportunityAction(opportunityId)
      if (!res.ok) {
        toast.error(res.error ?? 'Could not delete opportunity')
        return
      }
      toast.success('Opportunity deleted')
      onChanged()
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={!!opportunityId} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit opportunity</DialogTitle>
          <DialogDescription>
            Update the opportunity, move it to another stage, or delete
            it.
          </DialogDescription>
        </DialogHeader>

        {loading || !form ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <form onSubmit={handleSave}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-1.5">
                <Label htmlFor="edit-name">Opportunity name</Label>
                <Input
                  id="edit-name"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-value">Value (USD)</Label>
                  <Input
                    id="edit-value"
                    type="number"
                    min={0}
                    step="any"
                    value={form.value}
                    onChange={(e) => set('value', e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-stage">Stage</Label>
                  <select
                    id="edit-stage"
                    value={form.stageId}
                    onChange={(e) => set('stageId', e.target.value)}
                    className={SELECT_CLASS}
                  >
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-prob">Probability (%)</Label>
                  <Input
                    id="edit-prob"
                    type="number"
                    min={0}
                    max={100}
                    value={form.probability}
                    onChange={(e) => set('probability', e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-close">Expected close</Label>
                  <Input
                    id="edit-close"
                    type="date"
                    value={form.expectedCloseDate}
                    onChange={(e) => set('expectedCloseDate', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-company">Company</Label>
                  <Input
                    id="edit-company"
                    value={form.companyName}
                    onChange={(e) => set('companyName', e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-contact">Contact name</Label>
                  <Input
                    id="edit-contact"
                    value={form.contactName}
                    onChange={(e) => set('contactName', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-email">Contact email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => set('contactEmail', e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-phone">Contact phone</Label>
                  <Input
                    id="edit-phone"
                    value={form.contactPhone}
                    onChange={(e) => set('contactPhone', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="edit-closer">Assigned closer</Label>
                <select
                  id="edit-closer"
                  value={form.assignedCloserId}
                  onChange={(e) => set('assignedCloserId', e.target.value)}
                  className={SELECT_CLASS}
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name ?? m.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter className="sm:justify-between">
              {confirmingDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Delete this deal?</span>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    disabled={pending}
                  >
                    Confirm
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={pending}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={pending}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
