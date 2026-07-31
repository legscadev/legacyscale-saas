'use client'

// Convert-to-deal dialog. Spawns a pipeline opportunity from a
// qualified lead (contact fields copy across as free text) and marks
// the lead CONVERTED. Deal value + closer are optional seeds; stage
// defaults to the pipeline's first column.

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

import type { LeadListItem } from '@/lib/services/crm-lead-service'

import { convertLeadAction } from '@/app/(admin)/admin/crm/contacts/actions'
import type { CrmTeamMember } from '@/app/(admin)/admin/crm/contacts/actions'

const SELECT_CLASS =
  'h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

interface ConvertLeadDialogProps {
  lead: LeadListItem | null
  onOpenChange: (open: boolean) => void
  members: CrmTeamMember[]
  onConverted: () => void
}

export function ConvertLeadDialog({
  lead,
  onOpenChange,
  members,
  onConverted,
}: ConvertLeadDialogProps) {
  const [pending, startTransition] = useTransition()
  const [value, setValue] = useState('')
  const [assignedCloserId, setAssignedCloserId] = useState('')

  function handleOpenChange(next: boolean) {
    if (!next) {
      setValue('')
      setAssignedCloserId('')
    }
    onOpenChange(next)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!lead) return
    const parsedValue = value.trim() === '' ? null : Number(value)
    if (parsedValue !== null && Number.isNaN(parsedValue)) {
      toast.error('Deal value must be a number')
      return
    }
    startTransition(async () => {
      const res = await convertLeadAction({
        leadId: lead.id,
        value: parsedValue,
        assignedCloserId: assignedCloserId || null,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not convert lead')
        return
      }
      toast.success('Lead converted to a deal')
      onConverted()
      handleOpenChange(false)
    })
  }

  return (
    <Dialog open={!!lead} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Convert to deal</DialogTitle>
            <DialogDescription>
              {lead
                ? `Create a pipeline opportunity from ${lead.fullName}. The lead is marked converted.`
                : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="convert-value">Deal value (USD)</Label>
              <Input
                id="convert-value"
                type="number"
                min={0}
                step="any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="5000"
                autoFocus
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="convert-closer">Assign to</Label>
              <select
                id="convert-closer"
                value={assignedCloserId}
                onChange={(e) => setAssignedCloserId(e.target.value)}
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
              {pending ? 'Converting…' : 'Convert'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
