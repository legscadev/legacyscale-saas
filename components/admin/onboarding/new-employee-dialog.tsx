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
import type { LinkableUser } from '@/lib/services/employee-service'
import type { TemplateListItem } from '@/lib/services/checklist-template-service'

import { createEmployeeAction } from '@/app/(admin)/admin/onboarding/actions'
import {
  EmployeeAccessSection,
  INITIAL_ACCESS,
  type AccessState,
} from './employee-access-section'
import { EmployeeNameField } from './employee-name-field'

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
  const [linkedUser, setLinkedUser] = useState<LinkableUser | null>(null)
  const [roleTitle, setRoleTitle] = useState('')
  const [onboardingDate, setOnboardingDate] = useState('')
  // We track only the user's *override* — the effective value is
  // derived below. That way we don't need an effect to preselect on
  // open (which would trip react-hooks/purity for the setState).
  const [pickedSlug, setPickedSlug] = useState<string | null>(null)
  const [access, setAccess] = useState<AccessState>(INITIAL_ACCESS)
  const [pending, startTransition] = useTransition()

  const defaultSlug = useMemo(() => {
    const preferred =
      templates.find((t) => t.isDefault) ?? templates[0] ?? null
    return preferred?.slug ?? NO_TEMPLATE
  }, [templates])

  const templateSlug = pickedSlug ?? defaultSlug

  function reset() {
    setName('')
    setLinkedUser(null)
    setRoleTitle('')
    setOnboardingDate('')
    setPickedSlug(null)
    setAccess(INITIAL_ACCESS)
  }

  function handleLink(user: LinkableUser) {
    setLinkedUser(user)
    // Sync the name field with the picked user so the payload we
    // eventually send matches what the admin sees.
    setName(user.name || user.email)
    // A linked user brings their own account; the "create new
    // account" branch is meaningless here.
    setAccess(INITIAL_ACCESS)
  }

  function handleUnlink() {
    setLinkedUser(null)
    setName('')
  }

  // Submit gate:
  //   - name + roleTitle always required
  //   - if not linked and access checkbox is on, email must be filled
  const accessOk =
    linkedUser !== null || !access.enabled || access.email.trim() !== ''
  const canSubmit = !pending && Boolean(name) && Boolean(roleTitle) && accessOk

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    startTransition(async () => {
      try {
        const employee = await createEmployeeAction({
          name,
          roleTitle,
          onboardingDate: onboardingDate || null,
          templateSlug: templateSlug === NO_TEMPLATE ? null : templateSlug,
          // Linked user takes precedence; access.enabled is ignored
          // when a user is already linked.
          linkUserId: linkedUser?.id ?? null,
          grantAccess: !linkedUser && access.enabled,
          accessRole:
            !linkedUser && access.enabled ? access.accessRole : undefined,
          email:
            !linkedUser && access.enabled ? access.email.trim() : undefined,
        })

        const successMessage = linkedUser
          ? `Added ${employee.name} — linked to ${linkedUser.name || linkedUser.email}`
          : access.enabled
            ? `Added ${employee.name} — invite sent`
            : `Added ${employee.name}`
        toast.success(successMessage)
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
            Search for an existing user or add a brand-new hire.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <EmployeeNameField
            value={name}
            onChange={setName}
            linkedUser={linkedUser}
            onLink={handleLink}
            onUnlink={handleUnlink}
            disabled={pending}
          />
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

          {/* Access section only makes sense when we're creating a
              brand-new record. If an existing user was linked, they
              already have an account (and role) — nothing to decide. */}
          {linkedUser ? null : (
            <EmployeeAccessSection
              state={access}
              onChange={setAccess}
              disabled={pending}
            />
          )}

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
