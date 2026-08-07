'use client'

import { useEffect, useState } from 'react'
import { Mail, Phone, User, UserPlus2 } from 'lucide-react'
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
import { adminCreateMemberSchema } from '@/lib/validations/admin-members'
import {
  fetchAvailableRolesAction,
  setUserRolesAction,
} from '@/app/(admin)/admin/team/actions'
import type { RoleSummary } from '@/lib/services/role-service'
import type { MembershipOption } from './members-shell'

type UserRole = 'ADMIN' | 'TEAM' | 'MEMBER'
type FieldErrors = Partial<
  Record<'name' | 'email' | 'phone' | 'role' | 'membershipId', string[]>
>

/** Sentinel for "no membership" — Radix Select disallows empty values. */
const NONE_MEMBERSHIP = '__none__'

interface MemberCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  memberships: MembershipOption[]
  /** Fires after a member is successfully created. */
  onCreated: () => void
  /** Restrict the role picker to a subset (e.g. Team page uses
   *  [ADMIN, TEAM]). When the array collapses to a single role the
   *  role picker is hidden entirely and the tier is fixed. */
  allowedRoles?: UserRole[]
  /** Which tier to pre-select when the role picker is hidden.
   *  Only used in single-role lenses (e.g. Students → MEMBER). */
  defaultRole?: UserRole
  /** Singular noun shown in the dialog title — defaults to
   *  "student". Team page overrides to "team member". */
  entityLabel?: string
}

/** Excluded from the picker — these are per-user shims migrated
 *  from the old TeamModuleGrant table and shouldn't clutter the
 *  create/edit dropdown. */
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

export function MemberCreateDialog({
  open,
  onOpenChange,
  memberships,
  onCreated,
  allowedRoles,
  defaultRole,
  entityLabel = 'student',
}: MemberCreateDialogProps) {
  // Team lens shows the role picker (ADMIN + TEAM + optionally
  // MEMBER). Student lens (allowedRoles=[MEMBER]) hides it —
  // students don't get custom roles at creation.
  const showRoleField = !allowedRoles || allowedRoles.length > 1
  const fixedTier: UserRole =
    defaultRole ?? (allowedRoles && allowedRoles.length === 1 ? allowedRoles[0]! : 'MEMBER')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedRoleId, setSelectedRoleId] = useState<string>('')
  const [availableRoles, setAvailableRoles] = useState<RoleSummary[]>([])
  const [rolesLoading, setRolesLoading] = useState(false)
  const [membershipId, setMembershipId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  useEffect(() => {
    if (!open || !showRoleField) return
    setRolesLoading(true)
    fetchAvailableRolesAction().then((res) => {
      setRolesLoading(false)
      if (!res.ok) return
      const pickable = res.data.filter(isPickable)
      setAvailableRoles(pickable)
      // Preselect the first non-admin role as a sensible default
      // (avoids granting Admin tier by accident).
      const preferred =
        pickable.find((r) => r.slug === 'internal-team') ?? pickable[0]
      if (preferred) setSelectedRoleId(preferred.id)
    })
  }, [open, showRoleField])

  const reset = () => {
    setName('')
    setEmail('')
    setPhone('')
    setSelectedRoleId(availableRoles[0]?.id ?? '')
    setMembershipId(null)
    setError(null)
    setFieldErrors({})
    setSubmitting(false)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const derivedTier: UserRole = showRoleField
    ? (availableRoles.find((r) => r.id === selectedRoleId)
        ? tierForRoleSlug(
            availableRoles.find((r) => r.id === selectedRoleId)!.slug,
          )
        : 'TEAM')
    : fixedTier

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    if (showRoleField && !selectedRoleId) {
      setFieldErrors({ role: ['Pick a role'] })
      return
    }

    // Membership only applies to MEMBER tier.
    const payloadMembershipId = derivedTier === 'MEMBER' ? membershipId : null

    const parsed = adminCreateMemberSchema.safeParse({
      name,
      email,
      phone,
      role: derivedTier,
      membershipId: payloadMembershipId,
    })
    if (!parsed.success) {
      const next: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (
          key === 'name' ||
          key === 'email' ||
          key === 'phone' ||
          key === 'role' ||
          key === 'membershipId'
        ) {
          if (!next[key]) next[key] = []
          next[key]!.push(issue.message)
        }
      }
      setFieldErrors(next)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        const details = json.error?.details
        if (details && typeof details === 'object') {
          setFieldErrors(details)
        } else {
          setError(json.error?.message ?? 'Failed to create member')
        }
        return
      }

      // Assign the picked custom role. Only meaningful for TEAM
      // tier (MEMBER users don't hold roles today; ADMIN bypasses
      // the gate but still gets the assignment for consistency).
      if (showRoleField && selectedRoleId && derivedTier !== 'MEMBER') {
        const assignRes = await setUserRolesAction({
          targetUserId: json.data.member.id,
          roleIds: [selectedRoleId],
        })
        if (!assignRes.ok) {
          toast.error(
            assignRes.error ?? 'Member created but could not assign role',
          )
        }
      }

      toast.success(`Invite sent to ${json.data.member.email}`, {
        description: 'They have 7 days to set their password.',
      })
      onCreated()
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add {entityLabel}</DialogTitle>
            <DialogDescription>
              We&apos;ll email them a link to set their password. The link
              is valid for 7 days.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="member-name">
              Full name
              <RequiredMark />
            </Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="member-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
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
            <Label htmlFor="member-email">
              Email
              <RequiredMark />
            </Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="member-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@agency.com"
                autoComplete="email"
                className="pl-8"
                disabled={submitting}
                aria-invalid={!!fieldErrors.email}
                aria-required="true"
              />
            </div>
            {fieldErrors.email?.[0] && (
              <p className="text-xs text-destructive" role="alert">
                {fieldErrors.email[0]}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="member-phone">
              Phone <span className="text-muted-foreground">(optional)</span>
            </Label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="member-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 000 0000"
                autoComplete="tel"
                className="pl-8"
                disabled={submitting}
                aria-invalid={!!fieldErrors.phone}
              />
            </div>
            {fieldErrors.phone?.[0] && (
              <p className="text-xs text-destructive" role="alert">
                {fieldErrors.phone[0]}
              </p>
            )}
          </div>

          {showRoleField ? (
            <div className="space-y-2">
              <Label htmlFor="member-role">
                Role
                <RequiredMark />
              </Label>
              <Select
                value={selectedRoleId}
                onValueChange={(v) => v && setSelectedRoleId(v)}
                disabled={rolesLoading || availableRoles.length === 0}
              >
                <SelectTrigger className="w-full" id="member-role">
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
              <p className="text-xs text-muted-foreground">
                Determines which modules the user can reach. Manage roles
                on the <a href="/admin/roles" className="underline">Roles</a> page.
              </p>
              {fieldErrors.role?.[0] && (
                <p className="text-xs text-destructive" role="alert">
                  {fieldErrors.role[0]}
                </p>
              )}
            </div>
          ) : (
            // Single-tier lens (e.g. /admin/students) — no picker.
            <input type="hidden" name="role" value={fixedTier} />
          )}

          {derivedTier === 'MEMBER' ? (
            <div className="space-y-2">
              <Label htmlFor="member-membership">Membership</Label>
              <Select
                value={membershipId ?? NONE_MEMBERSHIP}
                onValueChange={(v) =>
                  setMembershipId(v === NONE_MEMBERSHIP ? null : v)
                }
                disabled={submitting}
              >
                <SelectTrigger className="w-full" id="member-membership">
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
          ) : null}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter showCloseButton>
            <Button type="submit" loading={submitting}>
              {submitting ? (
                'Sending invite…'
              ) : (
                <>
                  <UserPlus2 />
                  Send invite
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
