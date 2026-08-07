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
import {
  fetchAvailableRolesAction,
  fetchUserRolesAction,
  setUserRolesAction,
} from '@/app/(admin)/admin/team/actions'
import type { RoleSummary } from '@/lib/services/role-service'
import type { MembershipOption } from './members-shell'

type UserRole = 'ADMIN' | 'TEAM' | 'MEMBER'
type FieldErrors = Partial<
  Record<'name' | 'role' | 'password' | 'confirm' | 'membershipId', string[]>
>

/** Sentinel for "no membership" — Radix Select disallows empty-string item
 *  values, so we map this back to null on submit. */
const NONE_MEMBERSHIP = '__none__'

interface MemberEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  member: {
    id: string
    name: string | null
    email: string
    phone: string | null
    role: UserRole
    membershipId: string | null
  }
  memberships: MembershipOption[]
  /** Block role edit when admin is editing themselves (server enforces too). */
  canChangeRole: boolean
  onSaved: () => void
  /** Restrict the picker to a subset of roles. Falls back to every
   *  role for legacy call sites. */
  allowedRoles?: UserRole[]
}

/** Excluded from the picker — per-user shims from the old
 *  TeamModuleGrant table shouldn't clutter the dropdown. */
function isPickable(role: RoleSummary): boolean {
  return !role.slug.startsWith('legacy-')
}

function tierForRoleSlug(slug: string): UserRole {
  return slug === 'admin' ? 'ADMIN' : 'TEAM'
}

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
  memberships,
  canChangeRole,
  onSaved,
  allowedRoles,
}: MemberEditDialogProps) {
  // Team lens (allowedRoles = [ADMIN, TEAM] or absent) shows the
  // role picker; single-tier lens (Students → [MEMBER]) hides it.
  const showRoleField =
    !allowedRoles || allowedRoles.filter((r) => r !== 'MEMBER').length > 0

  const [name, setName] = useState(member.name ?? '')
  const [phone, setPhone] = useState(member.phone ?? '')
  const [role, setRole] = useState<UserRole>(member.role)
  const [membershipId, setMembershipId] = useState<string | null>(
    member.membershipId,
  )
  const [availableRoles, setAvailableRoles] = useState<RoleSummary[]>([])
  const [selectedRoleId, setSelectedRoleId] = useState<string>('')
  const [rolesLoading, setRolesLoading] = useState(false)
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
      setPhone(member.phone ?? '')
      setRole(member.role)
      setMembershipId(member.membershipId)
      setShowPasswordFields(false)
      setPassword('')
      setConfirm('')
      setError(null)
      setFieldErrors({})
    }
  }, [
    open,
    member.id,
    member.name,
    member.phone,
    member.role,
    member.membershipId,
  ])

  // Fetch pickable custom roles + the member's current assignment
  // when the dialog opens. Only when we're in a lens that shows the
  // role picker.
  useEffect(() => {
    if (!open || !showRoleField) return
    setRolesLoading(true)
    void Promise.all([
      fetchAvailableRolesAction(),
      fetchUserRolesAction(member.id),
    ]).then(([rolesRes, currentRes]) => {
      setRolesLoading(false)
      if (!rolesRes.ok) return
      const pickable = rolesRes.data.filter(isPickable)
      setAvailableRoles(pickable)

      // Preselect: first current role assignment if any, else a
      // sensible default derived from the member's tier.
      let preselect = ''
      if (currentRes.ok && currentRes.data.length > 0) {
        const currentPickable = currentRes.data.find((a) =>
          pickable.some((p) => p.id === a.roleId),
        )
        if (currentPickable) preselect = currentPickable.roleId
      }
      if (!preselect) {
        const fallback =
          member.role === 'ADMIN'
            ? pickable.find((r) => r.slug === 'admin')
            : pickable.find((r) => r.slug === 'internal-team') ?? pickable[0]
        if (fallback) preselect = fallback.id
      }
      setSelectedRoleId(preselect)
    })
  }, [open, showRoleField, member.id, member.role])

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

    // When the role picker is shown, derive tier from the selected
    // custom role's slug. Otherwise keep the current tier.
    let derivedRole: UserRole = role
    if (showRoleField) {
      if (!selectedRoleId) {
        errors.role = ['Pick a role']
      } else {
        const picked = availableRoles.find((r) => r.id === selectedRoleId)
        if (picked) derivedRole = tierForRoleSlug(picked.slug)
      }
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
    const body: {
      name?: string
      phone?: string
      role?: UserRole
      password?: string
      membershipId?: string | null
    } = {}
    if (parsedName.data !== member.name) body.name = parsedName.data
    if (phone.trim() !== (member.phone ?? '')) body.phone = phone.trim()
    if (canChangeRole && derivedRole !== member.role) body.role = derivedRole
    if (parsedPassword !== undefined) body.password = parsedPassword
    if (membershipId !== member.membershipId) body.membershipId = membershipId

    // Role assignment is a separate call — always run it when the
    // picker was shown so a role change without other edits still
    // takes effect.
    const shouldAssignRole = showRoleField && !!selectedRoleId

    if (Object.keys(body).length === 0 && !shouldAssignRole) {
      // Nothing changed — just close.
      onOpenChange(false)
      return
    }

    setSubmitting(true)
    try {
      // If there are basic fields to update, hit the PATCH first.
      // A pure role reassignment (empty body) skips this.
      let updatedEmail = member.email
      if (Object.keys(body).length > 0) {
        const res = await fetch(`/api/admin/students/${member.id}`, {
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
        updatedEmail = json.data.member.email
      }

      // Assign the picked custom role. Only meaningful when the
      // resulting tier is TEAM/ADMIN — MEMBER tier users don't
      // hold custom roles today.
      if (shouldAssignRole && derivedRole !== 'MEMBER') {
        const assignRes = await setUserRolesAction({
          targetUserId: member.id,
          roleIds: [selectedRoleId],
        })
        if (!assignRes.ok) {
          toast.error(
            assignRes.error ?? 'Member updated but could not assign role',
          )
        }
      }

      toast.success(
        body.password !== undefined
          ? `Updated ${updatedEmail} (password reset)`
          : `Updated ${updatedEmail}`,
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
            <Label htmlFor="edit-phone">
              Phone <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="edit-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 000 0000"
              autoComplete="tel"
              disabled={submitting}
            />
          </div>

          {showRoleField ? (
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select
                value={selectedRoleId}
                onValueChange={(v) => v && setSelectedRoleId(v)}
                disabled={
                  !canChangeRole || rolesLoading || availableRoles.length === 0
                }
              >
                <SelectTrigger className="w-full" id="edit-role">
                  <SelectValue>
                    {(v: string) =>
                      availableRoles.find((r) => r.id === v)?.name ??
                      (rolesLoading ? 'Loading roles…' : 'Pick a role')
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                      {r.slug === 'admin' ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          Full access
                        </span>
                      ) : null}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!canChangeRole && (
                <p className="text-xs text-muted-foreground">
                  You can&apos;t change your own role.
                </p>
              )}
              {fieldErrors.role?.[0] && (
                <p className="text-xs text-destructive" role="alert">
                  {fieldErrors.role[0]}
                </p>
              )}
            </div>
          ) : (
            // Locked lens (e.g. /admin/students) — role stays what it
            // already is; the picker isn't rendered.
            <input type="hidden" name="role" value={role} />
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-membership">Membership</Label>
            <Select
              value={membershipId ?? NONE_MEMBERSHIP}
              onValueChange={(v) =>
                setMembershipId(v === NONE_MEMBERSHIP ? null : v)
              }
              disabled={submitting}
            >
              <SelectTrigger className="w-full" id="edit-membership">
                <SelectValue>
                  {(v: string) =>
                    v === NONE_MEMBERSHIP || !v
                      ? 'No membership'
                      : (memberships.find((m) => m.id === v)?.name ??
                        'No membership')
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_MEMBERSHIP}>No membership</SelectItem>
                {memberships.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Gates access to paid courses in this tier. Only courses
              marked free stay visible to everyone.
            </p>
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
            <Button type="submit" loading={submitting}>
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
