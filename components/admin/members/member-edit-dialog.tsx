'use client'

import { useEffect, useState } from 'react'
import { KeyRound, Save, User } from 'lucide-react'
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
import { PasswordInput } from '@/components/auth/password-input'
import { nameSchema, passwordSchema } from '@/lib/validations/common'
import { userRoleSchema } from '@/lib/validations/user'

type Role = 'ADMIN' | 'TEAM' | 'MEMBER'
type FieldErrors = Partial<
  Record<'name' | 'role' | 'password' | 'confirm', string[]>
>

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
  { value: 'TEAM', label: 'Team — sees internal courses' },
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
  const [showPasswordFields, setShowPasswordFields] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  // Re-sync when the dialog opens against a (potentially different) row.
  useEffect(() => {
    if (open) {
      setName(member.name ?? '')
      setRole(member.role)
      setShowPasswordFields(false)
      setPassword('')
      setConfirm('')
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

    // Password block — only validated when the section is expanded.
    let parsedPassword: string | undefined
    if (showPasswordFields) {
      const pw = passwordSchema.safeParse(password)
      if (!pw.success) {
        errors.password = pw.error.issues.map((i) => i.message)
      } else if (password !== confirm) {
        errors.confirm = ['Passwords do not match']
      } else {
        parsedPassword = pw.data
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    // Only send fields that actually changed.
    const body: { name?: string; role?: Role; password?: string } = {}
    if (parsedName.data !== member.name) body.name = parsedName.data
    if (canChangeRole && role !== member.role) body.role = role
    if (parsedPassword !== undefined) body.password = parsedPassword

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
      toast.success(
        body.password !== undefined
          ? `Updated ${json.data.member.email} (password reset)`
          : `Updated ${json.data.member.email}`,
      )
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

          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            {showPasswordFields ? (
              <>
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="edit-password"
                    className="flex items-center gap-1.5"
                  >
                    <KeyRound className="size-3.5" />
                    Set a new password
                  </Label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordFields(false)
                      setPassword('')
                      setConfirm('')
                      setFieldErrors((p) => ({
                        ...p,
                        password: undefined,
                        confirm: undefined,
                      }))
                    }}
                    className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                </div>
                <PasswordInput
                  id="edit-password"
                  name="password"
                  placeholder="New password"
                  autoComplete="new-password"
                  value={password}
                  onChange={setPassword}
                />
                {fieldErrors.password?.[0] ? (
                  <p className="text-xs text-destructive" role="alert">
                    {fieldErrors.password[0]}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Min 4 characters. The member will sign in with this on
                    their next visit.
                  </p>
                )}
                <PasswordInput
                  id="edit-password-confirm"
                  name="confirm"
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={setConfirm}
                />
                {fieldErrors.confirm?.[0] && (
                  <p className="text-xs text-destructive" role="alert">
                    {fieldErrors.confirm[0]}
                  </p>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowPasswordFields(true)}
                className="flex w-full items-center gap-2 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
                disabled={submitting}
              >
                <KeyRound className="size-3.5" />
                Change password
                <span className="ml-auto text-xs text-muted-foreground/70">
                  Resets without an email
                </span>
              </button>
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
