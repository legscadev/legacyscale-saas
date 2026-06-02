'use client'

import { useState } from 'react'
import { Check, Copy, Mail, User, UserPlus2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
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
  /** Fires after a member is successfully created and the dialog closes. */
  onCreated: () => void
}

interface CreatedMember {
  email: string
  name: string | null
  temporaryPassword: string
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
  const [created, setCreated] = useState<CreatedMember | null>(null)
  const [copied, setCopied] = useState(false)

  const reset = () => {
    setName('')
    setEmail('')
    setRole('MEMBER')
    setError(null)
    setFieldErrors({})
    setCreated(null)
    setSubmitting(false)
    setCopied(false)
  }

  const handleOpenChange = (next: boolean) => {
    // When the dialog closes after a successful create, refresh the list.
    if (!next && created) onCreated()
    if (!next) reset()
    onOpenChange(next)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    // Client-side validation via Zod — same schema the API uses, so the
    // two stay in sync. If the user gets past this, the server still
    // re-validates (defense in depth).
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
      setCreated({
        email: json.data.member.email,
        name: json.data.member.name,
        temporaryPassword: json.data.temporaryPassword,
      })
      toast.success(`Created ${json.data.member.email}`)
    } catch (err) {
      console.error(err)
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  const copyPassword = async () => {
    if (!created) return
    try {
      await navigator.clipboard.writeText(created.temporaryPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Couldn't copy — copy it manually from the field")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Member created</DialogTitle>
              <DialogDescription>
                Share the temporary password with {created.email}. You
                won&apos;t be able to see it again.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor="temp-password">Temporary password</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="temp-password"
                  readOnly
                  value={created.temporaryPassword}
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={copyPassword}
                  aria-label="Copy password"
                >
                  {copied ? <Check /> : <Copy />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                They&apos;ll be prompted to change it from their profile
                after signing in.
              </p>
            </div>

            <DialogFooter>
              <DialogClose render={<Button>Done</Button>} />
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <DialogHeader>
              <DialogTitle>Add member</DialogTitle>
              <DialogDescription>
                We&apos;ll generate a temporary password and email a
                welcome message.
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
                  'Creating…'
                ) : (
                  <>
                    <UserPlus2 />
                    Create member
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
