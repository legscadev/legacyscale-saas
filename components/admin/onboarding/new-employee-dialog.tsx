'use client'

import { useMemo, useState, useTransition } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { TemplateListItem } from '@/lib/services/checklist-template-service'

import { createEmployeeAction } from '@/app/(admin)/admin/onboarding/actions'

interface NewEmployeeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  templates: TemplateListItem[]
}

// Sentinel value for the "no template" option. Select values must be
// non-empty strings, so we round-trip through this token and translate
// back to null before hitting the action.
const NO_TEMPLATE = '__none__'

export function NewEmployeeDialog({
  open,
  onOpenChange,
  templates,
}: NewEmployeeDialogProps) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [roleTitle, setRoleTitle] = useState('')
  const [onboardingDate, setOnboardingDate] = useState('')
  // We track only the user's *override* — the effective value is
  // derived below. That way we don't need an effect to preselect on
  // open (which would trip react-hooks/purity for the setState).
  const [pickedSlug, setPickedSlug] = useState<string | null>(null)
  const [grantAccess, setGrantAccess] = useState(false)
  const [email, setEmail] = useState('')
  const [pending, startTransition] = useTransition()

  const defaultSlug = useMemo(() => {
    const preferred =
      templates.find((t) => t.isDefault) ?? templates[0] ?? null
    return preferred?.slug ?? NO_TEMPLATE
  }, [templates])

  const templateSlug = pickedSlug ?? defaultSlug

  function reset() {
    setName('')
    setRoleTitle('')
    setOnboardingDate('')
    setPickedSlug(null)
    setGrantAccess(false)
    setEmail('')
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
          templateSlug: templateSlug === NO_TEMPLATE ? null : templateSlug,
          grantAccess,
          email: grantAccess ? email.trim() : undefined,
        })
        toast.success(
          grantAccess
            ? `Added ${employee.name} — invite sent`
            : `Added ${employee.name}`,
        )
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
          <div className="space-y-1.5">
            <Label htmlFor="employee-template">Checklist template</Label>
            <Select
              value={templateSlug}
              onValueChange={(v) => setPickedSlug(v ?? NO_TEMPLATE)}
            >
              <SelectTrigger id="employee-template" className="h-9">
                <SelectValue>
                  {(v: string) => {
                    if (v === NO_TEMPLATE) return 'No template'
                    const t = templates.find((tt) => tt.slug === v)
                    return t
                      ? `${t.name}${t.isDefault ? ' · default' : ''}`
                      : 'Select template'
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TEMPLATE}>No template</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.slug}>
                    {t.name}
                    {t.isDefault ? ' · default' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded border-input"
                checked={grantAccess}
                onChange={(e) => setGrantAccess(e.target.checked)}
                disabled={pending}
              />
              <span>
                <span className="font-medium">Can access the system</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Creates a TEAM account and emails an invite link.
                </span>
              </span>
            </label>
            {grantAccess ? (
              <div className="space-y-1.5 pl-6">
                <Label htmlFor="employee-email">Login email</Label>
                <Input
                  id="employee-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@company.com"
                  required
                  disabled={pending}
                />
              </div>
            ) : null}
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
            <Button
              type="submit"
              disabled={
                pending ||
                !name ||
                !roleTitle ||
                (grantAccess && !email.trim())
              }
            >
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
