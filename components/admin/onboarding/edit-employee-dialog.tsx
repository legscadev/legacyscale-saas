'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
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

import { updateEmployeeAction } from '@/app/(admin)/admin/onboarding/actions'

export interface EditableEmployee {
  id: string
  name: string
  roleTitle: string
  onboardingDate: Date | null
  dateStarted: Date | null
  notes: string | null
}

interface EditEmployeeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: EditableEmployee | null
  /** Optional callback fired after a successful save so the caller
   *  can patch its own state without waiting for router.refresh. */
  onSaved?: (patch: {
    id: string
    name: string
    roleTitle: string
    onboardingDate: Date | null
    dateStarted: Date | null
    notes: string | null
  }) => void
}

// Shared edit dialog — reused by both the /admin/onboarding list
// (pencil action) and the /admin/onboarding/[id] detail page (⋯
// menu). Owns its own form state so callers only need to hand in
// the employee snapshot to seed from.
export function EditEmployeeDialog({
  open,
  onOpenChange,
  employee,
  onSaved,
}: EditEmployeeDialogProps) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [roleTitle, setRoleTitle] = useState('')
  const [onboardingDate, setOnboardingDate] = useState('')
  const [dateStarted, setDateStarted] = useState('')
  const [notes, setNotes] = useState('')
  const [pending, startTransition] = useTransition()

  // Whenever the employee changes (dialog opens on a different row),
  // reseed the form from the incoming snapshot so we never leak
  // state between rows.
  useEffect(() => {
    if (!employee) return
    setName(employee.name)
    setRoleTitle(employee.roleTitle)
    setOnboardingDate(toCalendarDateInput(employee.onboardingDate))
    setDateStarted(toCalendarDateInput(employee.dateStarted))
    setNotes(employee.notes ?? '')
  }, [employee])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!employee) return
    startTransition(async () => {
      try {
        await updateEmployeeAction(employee.id, {
          name: name.trim(),
          roleTitle: roleTitle.trim(),
          onboardingDate: onboardingDate || null,
          dateStarted: dateStarted || null,
          notes: notes.trim() ? notes.trim() : null,
        })
        toast.success('Employee updated')
        onOpenChange(false)
        onSaved?.({
          id: employee.id,
          name: name.trim(),
          roleTitle: roleTitle.trim(),
          onboardingDate: onboardingDate ? new Date(onboardingDate) : null,
          dateStarted: dateStarted ? new Date(dateStarted) : null,
          notes: notes.trim() ? notes.trim() : null,
        })
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update')
      }
    })
  }

  const canSubmit =
    !pending && name.trim().length > 0 && roleTitle.trim().length > 0

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!pending) onOpenChange(v)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {employee ? `Edit ${employee.name}` : 'Edit employee'}
          </DialogTitle>
          <DialogDescription>
            Update the employee&apos;s basics. Checklist status +
            offboarding are managed separately.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-role">Role title</Label>
            <Input
              id="edit-role"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-onboarding">Onboarding date</Label>
              <Input
                id="edit-onboarding"
                type="date"
                value={onboardingDate}
                onChange={(e) => setOnboardingDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-started">Date started</Label>
              <Input
                id="edit-started"
                type="date"
                value={dateStarted}
                onChange={(e) => setDateStarted(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything relevant — reporting line, tenure, comments…"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {pending ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
