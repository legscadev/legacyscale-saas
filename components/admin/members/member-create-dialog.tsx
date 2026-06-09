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

type Role = 'ADMIN' | 'MEMBER'
type FieldErrors = Partial<Record<'name' | 'email' | 'role', string[]>>

interface MemberCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Fires after a member is successfully created. */
  onCreated: () => void
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

export function MemberCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: MemberCreateDialogProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('MEMBER')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const reset = () => {
    setName('')
    setEmail('')
    setRole('MEMBER')
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

    // Client-side Zod validation — same schema the API uses.
    const parsed = adminCreateMemberSchema.safeParse({ name, email, role })
    if (!parsed.success) {
      const next: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (key === 'name' || key === 'email' || key === 'role') {
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

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter showCloseButton>
            <Button type="submit" disabled={submitting}>
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
