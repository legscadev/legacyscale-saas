'use client'

import { useState } from 'react'
import { Mail, User, UserPlus2 } from 'lucide-react'
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
import type { MemberCategoryOption } from './members-shell'

type Role = 'ADMIN' | 'TEAM' | 'MEMBER'
type FieldErrors = Partial<
  Record<'name' | 'email' | 'role' | 'categoryId', string[]>
>

/** Sentinel for "no category" — Radix Select disallows empty values. */
const NONE_CATEGORY = '__none__'

interface MemberCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: MemberCategoryOption[]
  /** Fires after a member is successfully created. */
  onCreated: () => void
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

export function MemberCreateDialog({
  open,
  onOpenChange,
  categories,
  onCreated,
}: MemberCreateDialogProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('MEMBER')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const reset = () => {
    setName('')
    setEmail('')
    setRole('MEMBER')
    setCategoryId(null)
    setError(null)
    setFieldErrors({})
    setSubmitting(false)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    // Category only applies to MEMBER role — admins/team bypass the gate.
    const payloadCategoryId = role === 'MEMBER' ? categoryId : null

    // Client-side Zod validation — same schema the API uses.
    const parsed = adminCreateMemberSchema.safeParse({
      name,
      email,
      role,
      categoryId: payloadCategoryId,
    })
    if (!parsed.success) {
      const next: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (
          key === 'name' ||
          key === 'email' ||
          key === 'role' ||
          key === 'categoryId'
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
      const res = await fetch('/api/admin/members', {
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
            <DialogTitle>Add member</DialogTitle>
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
            <Label htmlFor="member-role">Role</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole((v as Role) ?? 'MEMBER')}
            >
              <SelectTrigger className="w-full" id="member-role">
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
          </div>

          {role === 'MEMBER' ? (
            <div className="space-y-2">
              <Label htmlFor="member-category">Category</Label>
              <Select
                value={categoryId ?? NONE_CATEGORY}
                onValueChange={(v) =>
                  setCategoryId(v === NONE_CATEGORY ? null : v)
                }
                disabled={submitting}
              >
                <SelectTrigger className="w-full" id="member-category">
                  <SelectValue>
                    {(v: string) =>
                      v === NONE_CATEGORY || !v
                        ? 'No category'
                        : (categories.find((c) => c.id === v)?.name ??
                          'No category')
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_CATEGORY}>No category</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
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
