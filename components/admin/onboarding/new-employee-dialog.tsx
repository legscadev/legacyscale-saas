'use client'

import { useState, useTransition } from 'react'
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

import { createEmployeeAction } from '@/app/(admin)/admin/onboarding/actions'

interface NewEmployeeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NewEmployeeDialog({ open, onOpenChange }: NewEmployeeDialogProps) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [roleTitle, setRoleTitle] = useState('')
  const [onboardingDate, setOnboardingDate] = useState('')
  const [pending, startTransition] = useTransition()

  function reset() {
    setName('')
    setRoleTitle('')
    setOnboardingDate('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return
    startTransition(async () => {
      try {
        const employee = await createEmployeeAction({
          name,
          roleTitle,
          onboardingDate: onboardingDate || null,
        })
        toast.success(`Added ${employee.name}`)
        reset()
        onOpenChange(false)
        router.push(`/admin/onboarding/${employee.id}`)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to add employee'
        toast.error(message)
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!pending) onOpenChange(v)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add employee</DialogTitle>
          <DialogDescription>
            Start a new onboarding record. You can fill in checklist items
            from the employee profile.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="employee-name">Name</Label>
            <Input
              id="employee-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="employee-role">Role</Label>
            <Input
              id="employee-role"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="Appointment Setter"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="employee-onboarding-date">Onboarding date</Label>
            <Input
              id="employee-onboarding-date"
              type="date"
              value={onboardingDate}
              onChange={(e) => setOnboardingDate(e.target.value)}
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
            <Button type="submit" disabled={pending || !name || !roleTitle}>
              {pending ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Adding…
                </>
              ) : (
                'Add employee'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
