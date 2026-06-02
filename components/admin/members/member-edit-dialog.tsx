'use client'

import { useEffect, useState } from 'react'
import { Save, User } from 'lucide-react'
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
import { nameSchema } from '@/lib/validations/common'
import { userRoleSchema } from '@/lib/validations/user'

type Role = 'ADMIN' | 'MEMBER'
type FieldErrors = Partial<Record<'name' | 'role', string[]>>

interface MemberEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  member: {
    id: string
    name: string | null
    email: string
    role: Role
  }
  /** Block role edit when admin is editing themselves (server enforces too). */
  canChangeRole: boolean
  onSaved: () => void
}

const ROLES: { value: Role; label: string }[] = [
  { value: 'MEMBER', label: 'Member' },
  { value: 'ADMIN', label: 'Admin' },
]

function RequiredMark() {
  return (
    <span aria-hidden="true" className="ml-0.5 text-destructive">
      *
    </span>
  )
}

export function MemberEditDialog({
  open,
  onOpenChange,
  member,
  canChangeRole,
  onSaved,
}: MemberEditDialogProps) {
  const [name, setName] = useState(member.name ?? '')
  const [role, setRole] = useState<Role>(member.role)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  // Re-sync when the dialog opens against a (potentially different) row.
  useEffect(() => {
    if (open) {
      setName(member.name ?? '')
      setRole(member.role)
      setError(null)
      setFieldErrors({})
    }
  }, [open, member.id, member.name, member.role])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    // Local validation
    const errors: FieldErrors = {}
    const parsedName = nameSchema.safeParse(name)
    if (!parsedName.success) {
      errors.name = parsedName.error.issues.map((i) => i.message)
    }
    const parsedRole = userRoleSchema.safeParse(role)
    if (!parsedRole.success) {
      errors.role = parsedRole.error.issues.map((i) => i.message)
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    // Only send fields that actually changed.
    const body: { name?: string; role?: Role } = {}
    if (parsedName.data !== member.name) body.name = parsedName.data
    if (canChangeRole && role !== member.role) body.role = role

    if (Object.keys(body).length === 0) {
      // Nothing changed — just close.
      onOpenChange(false)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        const details = json.error?.details
        if (details && typeof details === 'object') {
          setFieldErrors(details)
        } else {
          setError(json.error?.message ?? 'Failed to update member')
        }
        return
      }
      toast.success(`Updated ${json.data.member.email}`)
      onSaved()
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>Edit member</DialogTitle>
            <DialogDescription>
              Update {member.email}&apos;s name or role.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="edit-name">
              Full name
              <RequiredMark />
            </Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                className="pl-8"
                disabled={submitting}
                aria-invalid={!!fieldErrors.name}
                aria-required="true"
              />
            </div>
            {fieldErrors.name?.[0] && (
              <p className="text-xs text-destructive" role="alert">
                {fieldErrors.name[0]}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              type="email"
              value={member.email}
              disabled
              readOnly
            />
            <p className="text-xs text-muted-foreground">
              Email can&apos;t be changed here.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-role">Role</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole((v as Role) ?? 'MEMBER')}
              disabled={!canChangeRole}
            >
              <SelectTrigger className="w-full" id="edit-role">
                <SelectValue>
                  {(v: string) =>
                    ROLES.find((r) => r.value === v)?.label ?? 'Member'
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!canChangeRole && (
              <p className="text-xs text-muted-foreground">
                You can&apos;t change your own role.
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter showCloseButton>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                'Saving…'
              ) : (
                <>
                  <Save />
                  Save changes
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
